import * as React from 'react';
import { globalSyncOrchestrator } from '@/sync/SyncOrchestrator';
import { openDatabase, getFromStore, putInStore } from '@/offline/db';
import { apiClient } from '@/lib/apiClient';
import { globalSyncQueue } from '@/offline/SyncQueue';
import { getIsEffectivelyOnline } from '@/hooks/useSimulateOffline';

export interface SyncManagerState {
    isSyncing: boolean;
    lastSyncTime: string | null;
    lastSyncError: string | null;
    pendingCount: number;
    syncHistory: SyncHistoryEntry[];
}

export interface SyncHistoryEntry {
    time: string; // ISO timestamp
    pushed: number; // number of successful push operations
    pulled: number; // number of changes pulled from server
    failed: number; // number of failed push attempts
}

const SYNC_INTERVAL_MS = 30000;

/**
 * useSyncManager
 *
 * Single source of truth for all sync state.
 *
 * Boot sequence (deterministic, no race conditions):
 *   1. Read pendingCount from in-memory SyncQueue (already rehydrated from
 *      IndexedDB by initializeSyncQueue() in main.tsx before React renders)
 *   2. Read lastSyncTime from IndexedDB syncMeta store (async)
 *   3. Single setState — UI hydrates exactly once with both values together
 *   4. Subscribe to SyncQueue for future mutations
 *   5. Start first sync cycle ONLY after step 2 completes, so
 *      lastSyncTimeRef.current carries the correct delta anchor
 *   6. Set up periodic sync + online listener
 *
 * lastSyncTime write guarantee:
 *   Written to IndexedDB ONLY inside if (result.success).
 *   UI is updated to the new time ONLY if the IndexedDB write succeeds.
 *   If the write fails, UI keeps the previous lastSyncTime — no false promises.
 */
export function useSyncManager() {
    const [state, setState] = React.useState<SyncManagerState>({
        isSyncing: false,
        lastSyncTime: null,
        lastSyncError: null,
        pendingCount: 0,
        syncHistory: [],
    });

    const syncIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const dbRef = React.useRef<IDBDatabase | null>(null);
    const isSyncingRef = React.useRef(false);
    const lastSyncTimeRef = React.useRef<string | null>(null);

    // ── Execute sync cycle ────────────────────────────────────────────────────
    // Defined before the setup effect so it is stable when passed to setInterval
    // and the online listener. useCallback with [] is correct here because all
    // mutable values are accessed via refs, not closed-over state.
    const executeSyncCycle = React.useCallback(async () => {
        if (isSyncingRef.current) {
            console.log('[useSyncManager] Sync already in progress, skipping');
            return;
        }
        if (!getIsEffectivelyOnline()) {
            console.log('[useSyncManager] Offline, skipping sync');
            return;
        }

        isSyncingRef.current = true;
        setState(prev => ({ ...prev, isSyncing: true, lastSyncError: null }));

        try {
            if (!dbRef.current) {
                dbRef.current = await openDatabase();
            }

            console.log('[useSyncManager] Starting sync cycle...');
            const result = await globalSyncOrchestrator.executeSyncCycle(
                apiClient,
                dbRef.current,
                lastSyncTimeRef.current || undefined
            );
            console.log('[useSyncManager] Cycle result:', result);

            if (result.success) {
                const now = new Date().toISOString();
                const historyEntry = {
                    time: now,
                    pushed: result.phases.push?.succeeded || 0,
                    pulled: result.phases.pull?.changesApplied || 0,
                    failed: result.phases.push?.failed || 0,
                };

                // Fix 1: persist FIRST, update UI only on success.
                // lastSyncTime is written to IndexedDB before React state is
                // updated. If the write fails, we keep the previous lastSyncTime
                // in state — the UI never shows a time that is not durable.
                let persisted = false;
                try {
                    const metaDb = dbRef.current ?? await openDatabase();
                    await putInStore(metaDb, 'syncMeta', { key: 'lastSyncTime', value: now });
                    persisted = true;
                } catch (err) {
                    // Persist failed. Next refresh will show "Never" even though
                    // the sync succeeded in memory. Log so this is visible.
                    console.warn('[useSyncManager] Failed to persist lastSyncTime:', err);
                }

                // Only advance the ref if the value is durable on disk.
                // This ref is the delta anchor sent to the server on the next
                // pull — using an unpersisted value would cause the next pull
                // after a refresh to re-fetch data already applied.
                if (persisted) {
                    lastSyncTimeRef.current = now;
                }

                const pendingItems = globalSyncOrchestrator.getPendingItems();

                // Single setState — UI notified once, atomically.
                setState(prev => ({
                    ...prev,
                    isSyncing: false,
                    // Keep previous lastSyncTime if persist failed so UI
                    // never shows a time that is not backed by IndexedDB.
                    lastSyncTime: persisted ? now : prev.lastSyncTime,
                    lastSyncError: null,
                    pendingCount: pendingItems.length,
                    syncHistory: [historyEntry, ...prev.syncHistory].slice(0, 5),
                }));

                console.log('[useSyncManager] Sync successful', {
                    persisted,
                    changesApplied: result.phases.pull?.changesApplied || 0,
                    pushCount: result.phases.push?.succeeded || 0,
                    conflicts: result.phases.conflict?.conflictsDetected || 0,
                });
            } else {
                // Sync cycle returned success:false.
                // Do NOT touch lastSyncTime or pendingCount.
                setState(prev => ({
                    ...prev,
                    isSyncing: false,
                    lastSyncError: result.error || 'Unknown sync error',
                }));
                console.error('[useSyncManager] Sync failed:', result.error);
            }
        } catch (error: any) {
            // Unexpected throw.
            // Do NOT touch lastSyncTime or pendingCount.
            setState(prev => ({
                ...prev,
                isSyncing: false,
                lastSyncError: error?.message || 'Sync orchestration failed',
            }));
            console.error('[useSyncManager] Sync error:', error);
        } finally {
            isSyncingRef.current = false;
        }
    }, []); // refs only — no stale closure risk

    // ── Single setup effect ───────────────────────────────────────────────────
    // Fix 2: replaces the three separate Effects that previously raced.
    //
    // Everything runs sequentially inside one async function:
    //   open DB -> read queue -> read syncMeta -> setState once -> subscribe
    //   -> first sync (AFTER lastSyncTimeRef is set from IndexedDB)
    //
    // This guarantees the correct mental model:
    //   Load queue -> Load lastSyncTime -> Hydrate UI once -> Then sync
    React.useEffect(() => {
        let cleanupFn: (() => void) | undefined;

        const setup = async () => {
            try {
                // Step 1: open DB and store the handle
                const db = await openDatabase();
                dbRef.current = db;

                // Step 2: read pendingCount from in-memory queue.
                // Already rehydrated from IndexedDB by initializeSyncQueue()
                // in main.tsx before React renders.
                const pendingCount = globalSyncQueue.getPending().length;

                // Step 3: read lastSyncTime from IndexedDB.
                // Must complete BEFORE executeSyncCycle runs, because
                // executeSyncCycle reads lastSyncTimeRef.current as the pull
                // delta anchor. Without this, the first sync after a refresh
                // would re-fetch all data instead of just the delta.
                let restoredSyncTime: string | null = null;
                try {
                    const stored = await getFromStore(db, 'syncMeta', 'lastSyncTime');
                    if (stored?.value) {
                        restoredSyncTime = stored.value;
                        lastSyncTimeRef.current = stored.value;
                    }
                } catch {
                    // syncMeta unreadable — start fresh, not fatal
                }

                // Step 4: single setState — UI hydrates exactly once with both
                // pendingCount and lastSyncTime already resolved. No intermediate
                // render with stale values.
                setState(prev => ({
                    ...prev,
                    pendingCount,
                    lastSyncTime: restoredSyncTime,
                }));

                // Step 5: subscribe to future queue mutations.
                // Placed after the initial setState so the first callback
                // cannot fire before the hydration render above lands.
                const unsubscribe = globalSyncQueue.subscribe(() => {
                    setState(prev => ({
                        ...prev,
                        pendingCount: globalSyncQueue.getPending().length,
                    }));
                });

                // Step 6: run initial sync.
                // lastSyncTimeRef.current is now correctly set from IndexedDB.
                if (getIsEffectivelyOnline()) {
                    console.log('[useSyncManager] App mounted, running initial sync');
                    await executeSyncCycle();
                } else {
                    console.log('[useSyncManager] App mounted offline, skipping initial sync');
                }

                // Step 7: periodic sync every 30 seconds
                syncIntervalRef.current = setInterval(() => {
                    if (getIsEffectivelyOnline()) executeSyncCycle();
                }, SYNC_INTERVAL_MS);

                // Step 8: immediate sync when coming back online
                const handleOnline = () => {
                    console.log('[useSyncManager] Network online, triggering sync');
                    executeSyncCycle();
                };
                window.addEventListener('online', handleOnline);

                // Step 9: auto-clear sync error after 5 seconds
                const errorClearInterval = setInterval(() => {
                    setState(prev =>
                        prev.lastSyncError && !prev.isSyncing
                            ? { ...prev, lastSyncError: null }
                            : prev
                    );
                }, 5000);

                cleanupFn = () => {
                    unsubscribe();
                    window.removeEventListener('online', handleOnline);
                    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                    clearInterval(errorClearInterval);
                };
            } catch (error) {
                console.error('[useSyncManager] Setup failed:', error);
            }
        };

        setup();

        return () => {
            if (cleanupFn) cleanupFn();
        };
    }, [executeSyncCycle]);

    // ── Manual sync trigger ───────────────────────────────────────────────────
    const syncNow = React.useCallback(() => {
        console.log('[useSyncManager] Manual sync triggered');
        executeSyncCycle();
    }, [executeSyncCycle]);

    return {
        ...state,
        syncNow,
    };
}

/**
 * useSyncStatus
 *
 * Thin alias over useSyncManager with the exact interface required by the
 * Sync Visibility System spec. Use this in UI components.
 *
 *   const { pendingCount, isSyncing, lastSyncTime, triggerSync } = useSyncStatus();
 */
export function useSyncStatus() {
    const { pendingCount, isSyncing, lastSyncTime, syncNow, syncHistory } = useSyncManager();
    return {
        pendingCount,
        isSyncing,
        lastSyncTime,
        syncHistory,
        triggerSync: syncNow,
    };
}


// import { useEffect, useState, useCallback, useRef } from 'react';
// import { globalSyncOrchestrator } from '@/sync/SyncOrchestrator';
// import { openDatabase, getFromStore, putInStore } from '@/offline/db';
// import { apiClient } from '@/lib/apiClient';
// import { globalSyncQueue } from '@/offline/SyncQueue';


// export interface SyncManagerState {
//     isSyncing: boolean;
//     lastSyncTime: string | null;
//     lastSyncError: string | null;
//     pendingCount: number;
// }

// const SYNC_INTERVAL_MS = 30000; // Sync every 30 seconds

// /**
//  * useSyncManager: Auto-triggers sync on mount, periodically, and when going online
//  * This is the heart of the offline sync system - connects SyncOrchestrator to the app lifecycle
//  */
// export function useSyncManager() {
//     const [state, setState] = useState<SyncManagerState>({
//         isSyncing: false,
//         lastSyncTime: null,
//         lastSyncError: null,
//         pendingCount: 0,
//     });

//     const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
//     const dbRef = useRef<IDBDatabase | null>(null);
//     const isSyncingRef = useRef(false);
//     const lastSyncTimeRef = useRef<string | null>(null);

//     /**
//      * Execute sync cycle
//      */
//     const executeSyncCycle = useCallback(async () => {
//         // Don't sync if already syncing
//         if (isSyncingRef.current) {
//             console.log('[useSyncManager] Sync already in progress, skipping');
//             return;
//         }

//         // Don't sync if offline
//         if (!navigator.onLine) {
//             console.log('[useSyncManager] Offline, skipping sync');
//             return;
//         }

//         isSyncingRef.current = true;
//         setState((prev) => ({ ...prev, isSyncing: true, lastSyncError: null }));

//         try {
//             // Initialize DB if needed
//             if (!dbRef.current) {
//                 dbRef.current = await openDatabase();
//             }

//             console.log('[useSyncManager] Starting sync cycle...');
//             const result = await globalSyncOrchestrator.executeSyncCycle(
//                 apiClient,
//                 dbRef.current,
//                 lastSyncTimeRef.current || undefined
//             );

//             console.log('[useSyncManager]: ...', result);

//             if (result.success) {
//                 const now = new Date().toISOString();
//                 lastSyncTimeRef.current = now;
//                 const pendingItems = globalSyncOrchestrator.getPendingItems();

//                 setState((prev) => ({
//                     ...prev,
//                     isSyncing: false,
//                     lastSyncTime: now,
//                     lastSyncError: null,
//                     pendingCount: pendingItems.length,
//                 }));

//                 console.log('[useSyncManager] Sync successful', {
//                     changesApplied: result.phases.pull?.changesApplied || 0,
//                     pushCount: result.phases.push?.succeeded || 0,
//                     conflicts: result.phases.conflict?.conflictsDetected || 0,
//                 });
//             } else {
//                 setState((prev) => ({
//                     ...prev,
//                     isSyncing: false,
//                     lastSyncError: result.error || 'Unknown sync error',
//                 }));

//                 console.error('[useSyncManager] Sync failed:', result.error);
//             }
//         } catch (error: any) {
//             const errorMsg = error?.message || 'Sync orchestration failed';
//             setState((prev) => ({
//                 ...prev,
//                 isSyncing: false,
//                 lastSyncError: errorMsg,
//             }));

//             console.error('[useSyncManager] Sync error:', error);
//         } finally {
//             isSyncingRef.current = false;
//         }
//     }, []);

//     /**
//      * Manual sync trigger
//      */
//     const syncNow = useCallback(() => {
//         console.log('[useSyncManager] Manual sync triggered');
//         executeSyncCycle();
//     }, [executeSyncCycle]);

//     /**
//      * Setup auto-sync on mount and cleanup on unmount
//      */
//     useEffect(() => {
//         const setupSync = async () => {
//             try {
//                 // Initialize DB
//                 if (!dbRef.current) {
//                     dbRef.current = await openDatabase();
//                 }

//                 // 1. Run sync immediately on mount (if online)
//                 if (navigator.onLine) {
//                     console.log('[useSyncManager] App mounted, running initial sync');
//                     await executeSyncCycle();
//                 } else {
//                     console.log('[useSyncManager] App mounted but offline, skipping initial sync');
//                 }

//                 // 2. Setup periodic sync (every 30 seconds if online)
//                 syncIntervalRef.current = setInterval(() => {
//                     if (navigator.onLine) {
//                         executeSyncCycle();
//                     }
//                 }, SYNC_INTERVAL_MS);

//                 // 3. Listen for online event - immediate sync when coming back online
//                 const handleOnline = () => {
//                     console.log('[useSyncManager] Network came online, triggering sync');
//                     executeSyncCycle();
//                 };

//                 window.addEventListener('online', handleOnline);

//                 // 4. Clear sync error after 5 seconds
//                 const errorTimeoutRef = setInterval(() => {
//                     setState((prev) => {
//                         if (prev.lastSyncError && !prev.isSyncing) {
//                             return { ...prev, lastSyncError: null };
//                         }
//                         return prev;
//                     });
//                 }, 5000);

//                 // Cleanup
//                 return () => {
//                     window.removeEventListener('online', handleOnline);
//                     if (syncIntervalRef.current) {
//                         clearInterval(syncIntervalRef.current);
//                     }
//                     if (errorTimeoutRef) {
//                         clearInterval(errorTimeoutRef);
//                     }
//                 };
//             } catch (error) {
//                 console.error('[useSyncManager] Setup failed:', error);
//             }
//         };

//         setupSync();
//     }, [executeSyncCycle]);

//     return {
//         ...state,
//         syncNow,
//     };
// }

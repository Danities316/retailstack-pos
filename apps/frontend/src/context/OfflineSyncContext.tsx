/**
 * OfflineSyncContext: Share sync state across UI.
 * Provides global access to:
 * - Sync status
 * - Pending mutations
 * - Conflicts
 * - Manual conflict resolution UI
 */

import * as React from 'react';
import { globalSyncOrchestrator } from '../sync/SyncOrchestrator';
import { useSyncManager } from '../hooks/useSyncManager';

export interface SyncContextValue {
    // Global sync state
    globalSyncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
    globalSyncError?: string;
    lastSyncTime?: string;

    // Conflict management
    visibleConflicts: any[];
    markConflictResolved: (entityId: string) => void;
    manualResolveConflict: (
        entityId: string,
        resolution: { strategy: 'KEEP_LOCAL' | 'ACCEPT_SERVER'; entityType: string }
    ) => Promise<void>;

    // Pending mutations count - live, updated on every enqueue/remove
    pendingCount: number;

    // Manual trigger
    triggerGlobalSync: () => Promise<void>;
}

const OfflineSyncContext = React.createContext<SyncContextValue | null>(null);

/**
 * Provider component.
 */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
    // Delegate all sync state to useSyncManager - single source of truth.
    // Previously this provider managed its own state in parallel with the hook,
    // meaning useOfflineSync() and useSyncManager() returned different values.
    // Now they are identical: the context is a thin re-export.
    const syncManager = useSyncManager();

    // Conflict state stays local to this provider - it is UI-only and does
    // not need to survive page refresh.
    const [visibleConflicts, setVisibleConflicts] = React.useState<any[]>([]);

    const triggerGlobalSync = React.useCallback(async () => {
        syncManager.syncNow();
    }, [syncManager.syncNow]);

    const markConflictResolved = React.useCallback((entityId: string) => {
        setVisibleConflicts((prev) => prev.filter((c) => c.entityId !== entityId));
    }, []);

    const manualResolveConflict = React.useCallback(async (
        entityId: string,
        resolution: { strategy: 'KEEP_LOCAL' | 'ACCEPT_SERVER'; entityType: string }
    ) => {
        try {
            const { openDatabase, getFromStore, putInStore } = await import('@/offline/db')
            const { globalSyncQueue } = await import('@/offline/SyncQueue')
            const db = await openDatabase()

            const storeMap: Record<string, string> = {
                product: 'products',
                sale: 'sales',
                category: 'categories',
            }
            const storeName = storeMap[resolution.entityType] || resolution.entityType
            const entity = await getFromStore(db, storeName, entityId)

            if (!entity) {
                console.warn('[Conflict] Entity not found in IndexedDB:', entityId)
                markConflictResolved(entityId)
                return
            }

            if (resolution.strategy === 'ACCEPT_SERVER') {
                // Apply the server version: overwrite local data with server data,
                // mark as CLEAN so it won't be pushed again
                entity.data = entity.meta.conflictServerData || entity.data
                entity.meta.version = entity.meta.conflictServerVersion || entity.meta.version
                entity.meta.syncStatus = 'CLEAN'
                entity.meta.conflictServerData = undefined
                entity.meta.conflictServerVersion = undefined
                entity.meta.conflictTimestamp = undefined
                await putInStore(db, storeName, entity)
                console.log('[Conflict] Resolved: accepted server version for', entityId)

            } else {
                // KEEP_LOCAL: mark as DIRTY and re-queue the local mutation
                // so it will be pushed to server on next sync
                entity.meta.syncStatus = 'DIRTY'
                entity.meta.conflictServerData = undefined
                entity.meta.conflictServerVersion = undefined
                entity.meta.conflictTimestamp = undefined
                await putInStore(db, storeName, entity)
                // Re-queue as an UPDATE so the server receives the local version
                globalSyncQueue.enqueue(
                    entityId,
                    resolution.entityType,
                    'UPDATE',
                    entity.data,
                    entity.meta.version,
                    entity.meta.version + 1
                )
                console.log('[Conflict] Resolved: kept local version, re-queued for sync', entityId)
            }

            markConflictResolved(entityId)
        } catch (err) {
            console.error('[Conflict] Resolution failed:', err)
            // Still remove from visible list so UI is not stuck
            markConflictResolved(entityId)
        }
    }, [markConflictResolved])

    const value: SyncContextValue = {
        // Derived from useSyncManager - always in sync with SyncQueue
        globalSyncStatus: syncManager.isSyncing ? 'SYNCING'
            : syncManager.lastSyncError ? 'ERROR'
                : 'IDLE',
        globalSyncError: syncManager.lastSyncError ?? undefined,
        lastSyncTime: syncManager.lastSyncTime ?? undefined,
        pendingCount: syncManager.pendingCount,
        // Conflict state - UI only
        visibleConflicts,
        markConflictResolved,
        manualResolveConflict,
        triggerGlobalSync,
    };

    return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

/**
 * Hook: useOfflineSync
 */
export function useOfflineSync(): SyncContextValue {
    const context = React.useContext(OfflineSyncContext);
    if (!context) {
        throw new Error('useOfflineSync must be used inside OfflineSyncProvider');
    }
    return context;
}

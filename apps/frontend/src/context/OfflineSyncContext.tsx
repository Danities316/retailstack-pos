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
    manualResolveConflict: (entityId: string, resolution: any) => Promise<void>;

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

    const manualResolveConflict = React.useCallback(async (entityId: string, resolution: any) => {
        // TODO (T-conflict): apply resolution to local entity, queue mutation, sync
        markConflictResolved(entityId);
    }, [markConflictResolved]);

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

// /**
//  * OfflineSyncContext: Share sync state across UI.
//  * Provides global access to:
//  * - Sync status
//  * - Pending mutations
//  * - Conflicts
//  * - Manual conflict resolution UI
//  */

// import React, { createContext, useContext, useState, useCallback } from 'react';
// import { globalSyncOrchestrator } from '../sync/SyncOrchestrator';

// export interface SyncContextValue {
//     // Global sync state
//     globalSyncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
//     globalSyncError?: string;
//     lastSyncTime?: string;

//     // Conflict management
//     visibleConflicts: any[];
//     markConflictResolved: (entityId: string) => void;
//     manualResolveConflict: (entityId: string, resolution: any) => Promise<void>;

//     // Manual trigger
//     triggerGlobalSync: () => Promise<void>;
// }

// const OfflineSyncContext = createContext<SyncContextValue | null>(null);

// /**
//  * Provider component.
//  */
// export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
//     const [globalSyncStatus, setGlobalSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
//     const [globalSyncError, setGlobalSyncError] = useState<string>();
//     const [lastSyncTime, setLastSyncTime] = useState<string>();
//     const [visibleConflicts, setVisibleConflicts] = useState<any[]>([]);

//     const triggerGlobalSync = useCallback(async () => {
//         setGlobalSyncStatus('SYNCING');
//         try {
//             // This would need real apiClient injected
//             // const result = await globalSyncOrchestrator.executeSyncCycle(apiClient, db);
//             setGlobalSyncStatus('IDLE');
//             setLastSyncTime(new Date().toISOString());
//         } catch (error: any) {
//             setGlobalSyncStatus('ERROR');
//             setGlobalSyncError(error.message);
//         }
//     }, []);

//     const markConflictResolved = useCallback((entityId: string) => {
//         setVisibleConflicts((prev) => prev.filter((c) => c.entityId !== entityId));
//     }, []);

//     const manualResolveConflict = useCallback(async (entityId: string, resolution: any) => {
//         // In real implementation:
//         // 1. Apply resolution to local entity
//         // 2. Queue new mutation with resolved data
//         // 3. Trigger sync
//         markConflictResolved(entityId);
//     }, [markConflictResolved]);

//     const value: SyncContextValue = {
//         globalSyncStatus,
//         globalSyncError,
//         lastSyncTime,
//         visibleConflicts,
//         markConflictResolved,
//         manualResolveConflict,
//         triggerGlobalSync,
//     };

//     return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
// }

// /**
//  * Hook: useOfflineSync
//  */
// export function useOfflineSync(): SyncContextValue {
//     const context = useContext(OfflineSyncContext);
//     if (!context) {
//         throw new Error('useOfflineSync must be used inside OfflineSyncProvider');
//     }
//     return context;
// }

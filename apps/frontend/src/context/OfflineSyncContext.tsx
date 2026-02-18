/**
 * OfflineSyncContext: Share sync state across UI.
 * Provides global access to:
 * - Sync status
 * - Pending mutations
 * - Conflicts
 * - Manual conflict resolution UI
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { globalSyncOrchestrator } from '../sync/SyncOrchestrator';

export interface SyncContextValue {
    // Global sync state
    globalSyncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
    globalSyncError?: string;
    lastSyncTime?: string;

    // Conflict management
    visibleConflicts: any[];
    markConflictResolved: (entityId: string) => void;
    manualResolveConflict: (entityId: string, resolution: any) => Promise<void>;

    // Manual trigger
    triggerGlobalSync: () => Promise<void>;
}

const OfflineSyncContext = createContext<SyncContextValue | null>(null);

/**
 * Provider component.
 */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
    const [globalSyncStatus, setGlobalSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
    const [globalSyncError, setGlobalSyncError] = useState<string>();
    const [lastSyncTime, setLastSyncTime] = useState<string>();
    const [visibleConflicts, setVisibleConflicts] = useState<any[]>([]);

    const triggerGlobalSync = useCallback(async () => {
        setGlobalSyncStatus('SYNCING');
        try {
            // This would need real apiClient injected
            // const result = await globalSyncOrchestrator.executeSyncCycle(apiClient, db);
            setGlobalSyncStatus('IDLE');
            setLastSyncTime(new Date().toISOString());
        } catch (error: any) {
            setGlobalSyncStatus('ERROR');
            setGlobalSyncError(error.message);
        }
    }, []);

    const markConflictResolved = useCallback((entityId: string) => {
        setVisibleConflicts((prev) => prev.filter((c) => c.entityId !== entityId));
    }, []);

    const manualResolveConflict = useCallback(async (entityId: string, resolution: any) => {
        // In real implementation:
        // 1. Apply resolution to local entity
        // 2. Queue new mutation with resolved data
        // 3. Trigger sync
        markConflictResolved(entityId);
    }, [markConflictResolved]);

    const value: SyncContextValue = {
        globalSyncStatus,
        globalSyncError,
        lastSyncTime,
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
    const context = useContext(OfflineSyncContext);
    if (!context) {
        throw new Error('useOfflineSync must be used inside OfflineSyncProvider');
    }
    return context;
}

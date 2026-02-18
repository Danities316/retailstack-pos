export type SyncStatus = 'CLEAN' | 'DIRTY' | 'SYNCING' | 'CONFLICT' | 'ERROR';

export interface OfflineEntityMeta {
    version: number; // Version from server
    syncStatus: SyncStatus;
    lastModifiedAt: string; // ISO 8601
    lastSyncedAt?: string; // ISO 8601
    deleted?: boolean;
    clientVersion?: number; // For conflict detection
    conflictServerVersion?: number; // Server version when conflict detected
    conflictServerData?: any; // Server data when conflict detected
    conflictTimestamp?: string; // ISO 8601, server timestamp of conflicting change
}

export interface OfflineEntity<T> {
    id: string;
    tenantId: string;
    data: T;
    meta: OfflineEntityMeta;
}

/**
 * Factory function to create a new offline entity.
 */
export function createOfflineEntity<T>(
    id: string,
    tenantId: string,
    data: T,
    version: number = 0,
    syncStatus: SyncStatus = 'CLEAN',
    deleted: boolean = false
): OfflineEntity<T> {
    const now = new Date().toISOString();
    return {
        id,
        tenantId,
        data,
        meta: {
            version,
            syncStatus,
            lastModifiedAt: now,
            lastSyncedAt: syncStatus === 'CLEAN' ? now : undefined,
            deleted,
        },
    };
}

/**
 * Mark an entity as dirty (locally modified).
 */
export function markDirty<T>(entity: OfflineEntity<T>): OfflineEntity<T> {
    return {
        ...entity,
        meta: {
            ...entity.meta,
            syncStatus: 'DIRTY',
            lastModifiedAt: new Date().toISOString(),
        },
    };
}

/**
 * PULL phase: fetch server changes and apply to local database.
 * Pure, testable module with no UI or SW logic.
 */

import { OfflineEntity } from '../domain/OfflineEntity';
import { SyncQueue } from '../offline/SyncQueue';

export interface PullResponse {
    serverTime: string; // ISO 8601
    changes: ServerChange[];
}

export interface ServerChange {
    entityType: string;
    entityId: string;
    version: number;
    data: any;
    deleted?: boolean;
    timestamp: string;
}

export interface PullPhaseResult {
    success: boolean;
    serverTime: string;
    changesApplied: number;
    error?: string;
}

/**
 * Execute PULL phase: fetch and apply server changes.
 */
export async function executePullPhase(
    apiClient: any, // HTTP client
    db: IDBDatabase,
    syncQueue: SyncQueue,
    lastSyncTime?: string
): Promise<PullPhaseResult> {
    try {
        // 1. Fetch changes from server
        const response = await apiClient.post('/sync/pull', {
            lastSyncTime: lastSyncTime || new Date(0).toISOString(),
        });

        if (!response.success) {
            return {
                success: false,
                serverTime: new Date().toISOString(),
                changesApplied: 0,
                error: response.error || 'Pull failed',
            };
        }

        const { serverTime, changes } = response.data;
        let changesApplied = 0;

        // 2. Apply each change to local database
        for (const change of changes) {
            const stored = await applyServerChange(db, change, syncQueue);
            if (stored) changesApplied++;
        }

        return {
            success: true,
            serverTime,
            changesApplied,
        };
    } catch (error: any) {
        return {
            success: false,
            serverTime: new Date().toISOString(),
            changesApplied: 0,
            error: error.message || 'Pull phase error',
        };
    }
}

/**
 * Apply a single server change to the database.
 * Detects conflicts: if local entity is DIRTY with pending mutations, mark as CONFLICT instead of overwriting.
 */
async function applyServerChange(
    db: IDBDatabase,
    change: ServerChange,
    syncQueue: SyncQueue
): Promise<boolean> {
    try {
        const { entityType, entityId, version, data, deleted, timestamp } = change;

        const storeMap: { [key: string]: string } = {
            product: 'products',
            sale: 'sales',
            inventory: 'inventory',
            category: 'categories',
        };

        const storeName = storeMap[entityType];
        if (!storeName) {
            console.warn(`Unknown entity type: ${entityType}`);
            return false;
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);

            transaction.onerror = () => {
                console.error('Transaction error:', transaction.error);
                reject(transaction.error);
            };

            transaction.onabort = () => {
                console.error('Transaction aborted');
                reject(new Error('Transaction aborted'));
            };

            transaction.oncomplete = () => {
                resolve(true);
            };

            if (deleted) {
                // Soft delete: check for conflicts
                const getRequest = store.get(entityId);
                getRequest.onsuccess = () => {
                    const existing = getRequest.result;
                    if (existing) {
                        // Check if local entity is DIRTY with pending mutations
                        if (existing.meta.syncStatus === 'DIRTY') {
                            const hasPendingMutation = syncQueue.getAll().some(
                                item => item.entityId === entityId && item.entityType === entityType && item.state === 'PENDING'
                            );
                            if (hasPendingMutation) {
                                // Mark as CONFLICT instead of overwriting
                                existing.meta.syncStatus = 'CONFLICT';
                                existing.meta.conflictServerVersion = version;
                                existing.meta.conflictServerData = data;
                                existing.meta.conflictTimestamp = timestamp;
                                console.warn(
                                    `Conflict detected: entity ${entityType}:${entityId} is DIRTY with pending mutations. Marked as CONFLICT.`
                                );
                                store.put(existing);
                                return;
                            }
                        }
                        // No conflict: apply deletion
                        existing.meta.deleted = true;
                        existing.meta.version = version;
                        existing.meta.lastSyncedAt = timestamp;
                        store.put(existing);
                    }
                };
                getRequest.onerror = () => {
                    reject(getRequest.error);
                };
            } else {
                // Create or update: check for conflicts
                const getRequest = store.get(entityId);
                getRequest.onsuccess = () => {
                    const existing = getRequest.result;
                    if (existing && existing.meta.syncStatus === 'DIRTY') {
                        // Check if local entity has pending mutations
                        const hasPendingMutation = syncQueue.getAll().some(
                            item => item.entityId === entityId && item.entityType === entityType && item.state === 'PENDING'
                        );
                        if (hasPendingMutation) {
                            // Mark as CONFLICT instead of overwriting
                            existing.meta.syncStatus = 'CONFLICT';
                            existing.meta.conflictServerVersion = version;
                            existing.meta.conflictServerData = data;
                            existing.meta.conflictTimestamp = timestamp;
                            console.warn(
                                `Conflict detected: entity ${entityType}:${entityId} is DIRTY with pending mutations. Marked as CONFLICT.`
                            );
                            store.put(existing);
                            return;
                        }
                    }
                    // No conflict: apply server change
                    const entity: OfflineEntity<any> = {
                        id: entityId,
                        tenantId: data.tenantId || '',
                        data: data.payload || data,
                        meta: {
                            version,
                            syncStatus: 'CLEAN',
                            lastModifiedAt: timestamp,
                            lastSyncedAt: timestamp,
                        },
                    };
                    store.put(entity);
                };
                getRequest.onerror = () => {
                    reject(getRequest.error);
                };
            }
        });
    } catch (error) {
        console.error('Error applying server change:', error);
        return false;
    }
}


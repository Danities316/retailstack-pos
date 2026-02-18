/**
 * CONFLICT phase: detect and mark conflicts (no auto-resolution).
 * Pure, testable module with no UI or SW logic.
 */

import { OfflineEntity, markDirty } from '../domain/OfflineEntity';

export interface ConflictMarker {
    entityId: string;
    entityType: string;
    baseVersion: number;
    serverVersion: number;
    clientVersion: number;
    conflictedAt: string;
}

export interface ConflictHandlerResult {
    success: boolean;
    conflictsDetected: number;
    conflictMarkers: ConflictMarker[];
    error?: string;
}

/**
 * Execute CONFLICT phase: detect version mismatches.
 * No auto-resolution — just mark entities as CONFLICT.
 */
export async function executeConflictHandler(
    db: IDBDatabase,
    pushResults: any[] // Results from push phase
): Promise<ConflictHandlerResult> {
    try {
        const conflictMarkers: ConflictMarker[] = [];

        for (const result of pushResults) {
            if (result.conflict) {
                // Conflict detected by server
                const marker: ConflictMarker = {
                    entityId: result.idempotencyKey.split('_')[1],
                    entityType: result.idempotencyKey.split('_')[0],
                    baseVersion: result.baseVersion || 0,
                    serverVersion: result.serverVersion || 0,
                    clientVersion: result.clientVersion || 0,
                    conflictedAt: new Date().toISOString(),
                };

                conflictMarkers.push(marker);

                // Mark entity as CONFLICT in database
                await markEntityAsConflict(db, marker);
            }
        }

        return {
            success: true,
            conflictsDetected: conflictMarkers.length,
            conflictMarkers,
        };
    } catch (error: any) {
        return {
            success: false,
            conflictsDetected: 0,
            conflictMarkers: [],
            error: error.message || 'Conflict handler error',
        };
    }
}

/**
 * Mark an entity as having a conflict.
 * This prevents silent data loss.
 */
async function markEntityAsConflict(db: IDBDatabase, marker: ConflictMarker): Promise<void> {
    const storeMap: { [key: string]: string } = {
        product: 'products',
        sale: 'sales',
        inventory: 'inventory',
        category: 'categories',
    };

    const storeName = storeMap[marker.entityType];
    if (!storeName) return;

    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.get(marker.entityId);

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const entity = request.result as OfflineEntity<any>;
            if (entity) {
                entity.meta.syncStatus = 'CONFLICT';
                entity.meta.lastModifiedAt = marker.conflictedAt;
                const putRequest = store.put(entity);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
}

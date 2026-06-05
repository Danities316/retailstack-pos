/**
 * useOfflineStore: React hook for offline domain data.
 * - Reads from IndexedDB
 * - Triggers sync via orchestrator
 * - Exposes sync status and conflicts
 * UI is a pure consumer, never talks to backend directly.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { OfflineEntity } from '../domain/OfflineEntity';
import { openDatabase, getAllFromStore, putInStore, getFromStore } from '../offline/db';
import { globalSyncQueue } from '../offline/SyncQueue';
import { globalSyncOrchestrator } from '../sync/SyncOrchestrator';

export interface UseOfflineStoreOptions {
    storeName: string; // 'products', 'sales', etc.
    autoSync?: boolean;
    syncIntervalMs?: number;
}

export interface UseOfflineStoreResult<T> {
    // Data
    items: OfflineEntity<T>[];
    loading: boolean;
    error?: string;

    // Mutations
    create: (data: T) => Promise<OfflineEntity<T>>;
    update: (id: string, data: Partial<T>) => Promise<OfflineEntity<T>>;
    delete: (id: string) => Promise<void>;

    // Sync
    syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
    triggerSync: () => Promise<void>;
    pendingMutations: number;
    conflicts: OfflineEntity<T>[];
}

/**
 * Hook: Use offline-first data store.
 */
export function useOfflineStore<T = any>(options: UseOfflineStoreOptions): UseOfflineStoreResult<T> {
    const { storeName, autoSync = true, syncIntervalMs = 30000 } = options;

    const [items, setItems] = useState<OfflineEntity<T>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();
    const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
    const [db, setDb] = useState<IDBDatabase | null>(null);

    // Initialize database
    useEffect(() => {
        (async () => {
            try {
                const database = await openDatabase();
                setDb(database);
                await loadItems(database);
                setLoading(false);
            } catch (err: any) {
                setError(err.message || 'Failed to open database');
                setLoading(false);
            }
        })();
    }, []);

    // Load items from store
    const loadItems = async (database: IDBDatabase) => {
        try {
            const allItems = await getAllFromStore(database, storeName);
            const notDeleted = allItems.filter((item) => !item.meta?.deleted);
            setItems(notDeleted);
        } catch (err: any) {
            setError(err.message || 'Failed to load items');
        }
    };

    // Create: add to store, queue mutation
    const create = useCallback(
        async (data: T): Promise<OfflineEntity<T>> => {
            if (!db) throw new Error('Database not initialized');

            const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const entity = {
                id,
                tenantId: (data as any).tenantId || '',
                data,
                meta: {
                    version: 0,
                    syncStatus: 'DIRTY' as const,
                    lastModifiedAt: new Date().toISOString(),
                },
            } as OfflineEntity<T>;

            await putInStore(db, storeName, entity);
            globalSyncQueue.enqueue(id, storeName, 'CREATE', data, 0, 1);

            setItems((prev) => [...prev, entity]);
            return entity;
        },
        [db, storeName]
    );

    // Update: modify local, queue mutation
    const update = useCallback(
        async (id: string, partialData: Partial<T>): Promise<OfflineEntity<T>> => {
            if (!db) throw new Error('Database not initialized');

            const existing = await getFromStore(db, storeName, id);
            if (!existing) throw new Error('Entity not found');

            const updated = {
                ...existing,
                data: { ...existing.data, ...partialData },
                meta: {
                    ...existing.meta,
                    syncStatus: 'DIRTY' as const,
                    lastModifiedAt: new Date().toISOString(),
                },
            } as OfflineEntity<T>;

            await putInStore(db, storeName, updated);
            globalSyncQueue.enqueue(
                id,
                storeName,
                'UPDATE',
                partialData,
                existing.meta.version,
                existing.meta.version + 1
            );

            setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
            return updated;
        },
        [db, storeName]
    );

    // Delete: mark as deleted
    const deleteItem = useCallback(
        async (id: string): Promise<void> => {
            if (!db) throw new Error('Database not initialized');

            const existing = await getFromStore(db, storeName, id);
            if (!existing) throw new Error('Entity not found');

            const deleted = {
                ...existing,
                meta: {
                    ...existing.meta,
                    deleted: true,
                    syncStatus: 'DIRTY' as const,
                    lastModifiedAt: new Date().toISOString(),
                },
            } as OfflineEntity<T>;

            await putInStore(db, storeName, deleted);
            globalSyncQueue.enqueue(
                id,
                storeName,
                'DELETE',
                {},
                existing.meta.version,
                existing.meta.version + 1
            );

            setItems((prev) => prev.filter((item) => item.id !== id));
        },
        [db, storeName]
    );

    // // Trigger sync
    const isSyncingRef = useRef(false);

    const triggerSync = useCallback(async () => {
        if (!db || isSyncingRef.current) return;

        isSyncingRef.current = true;
        setSyncStatus('SYNCING');

        try {
            const result = await globalSyncOrchestrator.executeSyncCycle(
                window as any,
                db
            );

            if (result.success) {
                setSyncStatus('IDLE');
                await loadItems(db);
            } else {
                setSyncStatus('ERROR');
                setError(result.error);
            }
        } catch (err: any) {
            setSyncStatus('ERROR');
            setError(err.message);
        } finally {
            isSyncingRef.current = false;
        }
    }, [db]);
    // const triggerSync = useCallback(async () => {
    //     if (!db) return;

    //     setSyncStatus('SYNCING');
    //     try {
    //         const result = await globalSyncOrchestrator.executeSyncCycle(
    //             window as any, // Replace with actual HTTP client
    //             db
    //         );

    //         if (result.success) {
    //             setSyncStatus('IDLE');
    //             await loadItems(db); // Refresh after sync
    //         } else {
    //             setSyncStatus('ERROR');
    //             setError(result.error);
    //         }
    //     } catch (err: any) {
    //         setSyncStatus('ERROR');
    //         setError(err.message);
    //     }
    // }, [db]);

    // Auto-sync interval
    useEffect(() => {
        if (!autoSync || !db) return;

        const interval = setInterval(() => {
            triggerSync();
        }, syncIntervalMs);

        return () => clearInterval(interval);
    }, [autoSync, db, syncIntervalMs, triggerSync]);

    // Get conflicts
    const conflicts = items.filter((item) => item.meta.syncStatus === 'CONFLICT');

    return {
        items,
        loading,
        error,
        create,
        update,
        delete: deleteItem,
        syncStatus,
        triggerSync,
        pendingMutations: globalSyncQueue.getPending().length,
        conflicts,
    };
}

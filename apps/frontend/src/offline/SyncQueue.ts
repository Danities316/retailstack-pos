import { openDatabase } from '@/offline/db'

export type QueueItemState = 'PENDING' | 'RETRYING' | 'POISONED';

export type MutationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
    // Idempotency & ordering
    idempotencyKey: string; // UUID: e.g., "product_123_v1_1234567890"
    sequenceNumber: number; // Global order: 1, 2, 3...

    // Entity versioning
    entityId: string;
    entityType: string; // e.g., 'product', 'sale', 'inventory'
    baseVersion: number; // Server version before this mutation
    clientVersion: number; // Client version after this mutation

    // Mutation data
    mutationType: MutationType;
    payload: any; // The actual change

    // Queue state
    state: QueueItemState;
    retryCount: number;
    createdAt: string; // ISO 8601
    lastRetryAt?: string; // ISO 8601
}

/**
 * Sync queue manager: deterministic, in-memory queue with persistence.
 */
export class SyncQueue {
    private queue: SyncQueueItem[] = [];
    private nextSequenceNumber = 1;
    private db: IDBDatabase | null = null;
    // NOTE: Previously 'retailstack-posdb'. Unified 2026 to share one DB with db.ts.
    // Existing users lose any queued items that were not yet synced.
    // Acceptable for pre-launch; add migration if needed post-launch.
    private readonly DB_NAME = 'retailstack_pos';
    private readonly DB_VERSION = 2;
    private readonly STORE_NAME = 'syncQueue';

    // Observer set - UI hooks subscribe here to react to queue mutations.
    // Using a Set so duplicate subscriptions from React StrictMode double-mount
    // are deduplicated automatically.
    private listeners: Set<() => void> = new Set();

    /**
     * Initialize IndexedDB for persistence.
     */
    async initialize(): Promise<void> {
        try {
            const db = await openDatabase();
            this.db = db;
            await this._loadFromDB();
        } catch (error) {
            console.error('[SyncQueue] IndexedDB open failed:', error);
            throw error;
        }
    }

    /**
     * Ensure store exists (for runtime safety).
     */
    private _ensureStoreExists(): void {
        if (!this.db || this.db.objectStoreNames.contains(this.STORE_NAME)) return;

        try {
            this.db.createObjectStore(this.STORE_NAME, { keyPath: 'idempotencyKey' });
        } catch (err) {
            // Store may already exist, ignore error
        }
    }

    /**
     * Load queue from IndexedDB (atomic read).
     */
    private async _loadFromDB(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onerror = () => {
                console.error('Failed to read syncQueue from IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                const items = (request.result as SyncQueueItem[]) || [];
                if (items.length > 0) {
                    this.loadFromState(items);
                    console.log(`Loaded ${items.length} items from IndexedDB`);
                }
                this._notify();
                resolve();
            };
        });
    }

    /**
     * Save queue to IndexedDB (atomic write).
     */
    private async _saveToDB(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);

            // Clear old entries
            store.clear();

            // Write all current items
            for (const item of this.queue) {
                store.add(item);
            }

            transaction.onerror = () => {
                console.error('Failed to write syncQueue to IndexedDB:', transaction.error);
                reject(transaction.error);
            };

            transaction.oncomplete = () => {
                resolve();
            };
        });
    }

    /**
     * Enqueue a mutation for sync.
     * Idempotency key is deterministic (based on entity identity, not time) to survive retries.
     */
    /**
     * Notify all subscribers that queue state has changed.
     * Called synchronously after every mutation so React state updates
     * in the same event-loop tick as the mutation.
     */
    private _notify(): void {
        this.listeners.forEach(fn => fn());
    }

    /**
     * Subscribe to queue mutations.
     * Returns an unsubscribe function - call it in useEffect cleanup.
     *
     * Usage:
     *   useEffect(() => globalSyncQueue.subscribe(() => refresh()), []);
     */
    subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    async enqueue(
        entityId: string,
        entityType: string,
        mutationType: MutationType,
        payload: any,
        baseVersion: number,
        clientVersion: number
    ): Promise<SyncQueueItem> {
        const idempotencyKey = `${entityType}_${entityId}_v${baseVersion}_v${clientVersion}_${mutationType}`;
        const item: SyncQueueItem = {
            idempotencyKey,
            sequenceNumber: this.nextSequenceNumber++,
            entityId,
            entityType,
            baseVersion,
            clientVersion,
            mutationType,
            payload,
            state: 'PENDING',
            retryCount: 0,
            createdAt: new Date().toISOString(),
        };

        this.queue.push(item);

        try {
            await this._saveToDB();
        } catch (err) {
            // DB write failed — remove the item from memory too so the queue
            // stays consistent with what is actually persisted on disk.
            // The caller will receive this error and must show the cashier a
            // visible failure — do NOT swallow it here.
            this.queue.pop();
            this.nextSequenceNumber--;
            console.error('[SyncQueue] Failed to persist enqueue to IndexedDB:', err);
            throw new Error(
                'Could not save sale to local storage. ' +
                'Your device storage may be full. Please free up space and try again.'
            );
        }

        this._notify();
        return item;
    }

    // enqueue(
    //     entityId: string,
    //     entityType: string,
    //     mutationType: MutationType,
    //     payload: any,
    //     baseVersion: number,
    //     clientVersion: number
    // ): SyncQueueItem {
    //     // Deterministic idempotency key: survives retries and deduplicates on server
    //     const idempotencyKey = `${entityType}_${entityId}_v${baseVersion}_v${clientVersion}_${mutationType}`;
    //     const item: SyncQueueItem = {
    //         idempotencyKey,
    //         sequenceNumber: this.nextSequenceNumber++,
    //         entityId,
    //         entityType,
    //         baseVersion,
    //         clientVersion,
    //         mutationType,
    //         payload,
    //         state: 'PENDING',
    //         retryCount: 0,
    //         createdAt: new Date().toISOString(),
    //     };

    //     this.queue.push(item);
    //     this._saveToDB().catch(err => console.error('Failed to persist enqueue:', err));
    //     this._notify();
    //     return item;
    // }

    /**
     * Get all pending items in order.
     */
    getPending(): SyncQueueItem[] {
        return this.queue.filter((item) => item.state === 'PENDING').sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    }

    /**
     * Get all items (for debugging).
     */
    getAll(): SyncQueueItem[] {
        return [...this.queue];
    }

    /**
     * Mark an item as RETRYING (after failed push).
     */
    markRetrying(idempotencyKey: string, maxRetries: number = 5): boolean {
        const item = this.queue.find((i) => i.idempotencyKey === idempotencyKey);
        if (!item) return false;

        item.retryCount++;
        item.lastRetryAt = new Date().toISOString();

        if (item.retryCount > maxRetries) {
            item.state = 'POISONED';
        } else {
            item.state = 'RETRYING';
        }

        this._saveToDB().catch(err => console.error('Failed to persist markRetrying:', err));
        this._notify();
        return true;
    }

    /**
     * Remove an item after successful ack.
     */
    remove(idempotencyKey: string): boolean {
        const index = this.queue.findIndex((i) => i.idempotencyKey === idempotencyKey);
        if (index === -1) return false;

        this.queue.splice(index, 1);
        this._saveToDB().catch(err => console.error('Failed to persist remove:', err));
        this._notify();
        return true;
    }

    /**
     * Clear entire queue (dangerous, for testing only).
     */
    clear(): void {
        this.queue = [];
        this.nextSequenceNumber = 1;
        this._saveToDB().catch(err => console.error('Failed to persist clear:', err));
        this._notify();
    }

    /**
     * Queue size.
     */
    size(): number {
        return this.queue.length;
    }

    /**
     * Load queue from persisted state (e.g., from IndexedDB).
     */
    loadFromState(items: SyncQueueItem[]): void {
        this.queue = items;
        const maxSeq = Math.max(...items.map((i) => i.sequenceNumber), 0);
        this.nextSequenceNumber = maxSeq + 1;
    }

    /**
     * Export queue for persistence.
     */
    getState(): SyncQueueItem[] {
        return [...this.queue];
    }
}

/**
 * Global singleton sync queue instance.
 */
export const globalSyncQueue = new SyncQueue();

/**
 * Initialize the global sync queue with IndexedDB persistence.
 * Call this once during app startup.
 */
export async function initializeSyncQueue(): Promise<void> {
    await globalSyncQueue.initialize();
}
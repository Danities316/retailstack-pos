const DB_NAME = 'retailstack_pos';
const DB_VERSION = 1; // Increment on schema changes

export interface IndexedDBConfig {
    dbName: string;
    version: number;
}

/**
 * Initialize IndexedDB connection with migration support.
 */
export function openDatabase(config: IndexedDBConfig = { dbName: DB_NAME, version: DB_VERSION }): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(config.dbName, config.version);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        // Handle schema upgrades
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const oldVersion = event.oldVersion;
            const newVersion = event.newVersion || config.version;

            // Migration path: v0 -> v1
            if (oldVersion < 1) {
                migrateToV1(db);
            }

            // Add future migrations here
            // if (oldVersion < 2) {
            //   migrateToV2(db);
            // }
        };
    });
}

/**
 * Migration to version 1: Create initial object stores.
 */
function migrateToV1(db: IDBDatabase) {
    // Products store
    if (!db.objectStoreNames.contains('products')) {
        const productsStore = db.createObjectStore('products', { keyPath: 'id' });
        productsStore.createIndex('tenantId', 'tenantId', { unique: false });
        productsStore.createIndex('syncStatus', 'meta.syncStatus', { unique: false });
    }

    // Sales store
    if (!db.objectStoreNames.contains('sales')) {
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        salesStore.createIndex('tenantId', 'tenantId', { unique: false });
        salesStore.createIndex('syncStatus', 'meta.syncStatus', { unique: false });
    }

    // Inventory store
    if (!db.objectStoreNames.contains('inventory')) {
        const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id' });
        inventoryStore.createIndex('tenantId', 'tenantId', { unique: false });
        inventoryStore.createIndex('syncStatus', 'meta.syncStatus', { unique: false });
    }

    // Categories store
    if (!db.objectStoreNames.contains('categories')) {
        const categoriesStore = db.createObjectStore('categories', { keyPath: 'id' });
        categoriesStore.createIndex('tenantId', 'tenantId', { unique: false });
        categoriesStore.createIndex('syncStatus', 'meta.syncStatus', { unique: false });
    }

    // Sync metadata store (stores last sync state)
    if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'key' });
    }
}

/**
 * Get a transaction for reading data.
 */
export async function readTransaction(
    db: IDBDatabase,
    storeName: string,
    mode: 'readonly' | 'readwrite' = 'readonly'
): Promise<IDBObjectStore> {
    return db.transaction(storeName, mode).objectStore(storeName);
}

/**
 * Get all records from a store.
 */
export async function getAllFromStore(db: IDBDatabase, storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Get a single record by ID.
 */
export async function getFromStore(db: IDBDatabase, storeName: string, id: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Put a record in a store (creates or updates).
 */
export async function putInStore(db: IDBDatabase, storeName: string, item: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as string);
    });
}

/**
 * Delete a record from a store.
 */
export async function deleteFromStore(db: IDBDatabase, storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

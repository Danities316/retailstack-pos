const DB_NAME = 'retailstack_pos';
const DB_VERSION = 3; // Increment on schema changes

export interface IndexedDBConfig {
    dbName: string;
    version: number;
}

/**
 * Initialize IndexedDB connection with migration support.
 */
const REQUIRED_STORE_NAMES = ['products', 'sales', 'inventory', 'categories', 'syncMeta', 'syncQueue', 'offlineAuth'];

export function openDatabase(config: IndexedDBConfig = { dbName: DB_NAME, version: DB_VERSION }): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(config.dbName, config.version);

        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const oldVersion = event.oldVersion;

            // Migration path: v0 -> v1
            if (oldVersion < 1) {
                migrateToV1(db);
            }

            // Migration path: v1 -> v2
            if (oldVersion < 2) {
                migrateToV2(db);
            }

            // Migration path: v2 -> v3: offlineAuth store
            if (oldVersion < 3) {
                migrateToV3(db);
            }

            // Migration path: v2 -> v3: offlineAuth store
            if (oldVersion < 3) {
                migrateToV3(db);
            }

            // Add future migrations here
            // if (oldVersion < 3) {
            //   migrateToV3(db);
            // }
        };

        request.onsuccess = async () => {
            const db = request.result;
            if (!hasRequiredStores(db)) {
                const currentVersion = db.version;
                db.close();
                try {
                    const repaired = await repairDatabase(config, currentVersion);
                    resolve(repaired);
                    return;
                } catch (error) {
                    reject(error);
                    return;
                }
            }
            resolve(db);
        };
    });
}

function hasRequiredStores(db: IDBDatabase): boolean {
    return REQUIRED_STORE_NAMES.every((name) => db.objectStoreNames.contains(name));
}

function repairDatabase(config: IndexedDBConfig, currentVersion: number): Promise<IDBDatabase> {
    const repairVersion = Math.max(config.version + 1, currentVersion + 1);
    return new Promise((resolve, reject) => {
        const repairRequest = indexedDB.open(config.dbName, repairVersion);

        repairRequest.onerror = () => reject(repairRequest.error);
        repairRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            migrateToV1(db);
            migrateToV2(db);
            migrateToV3(db);
        };
        repairRequest.onsuccess = () => resolve(repairRequest.result);
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
 * Migration to version 2: Ensure any missing stores from the initial schema are created.
 */
function migrateToV2(db: IDBDatabase) {
    // Reuse the v1 migration logic because it is idempotent.
    migrateToV1(db);

    // Create the syncQueue store if it doesn't exist.
    // This store is owned by SyncQueue.ts but must be declared here
    // because db.ts controls the canonical schema version.
    // SyncQueue.ts opens the same database — it must never open at a
    // lower version number or the browser will block it.
    if (!db.objectStoreNames.contains('syncQueue')) {
        const syncQueueStore = db.createObjectStore('syncQueue', {
            keyPath: 'idempotencyKey',
        });
        syncQueueStore.createIndex('state', 'state', { unique: false });
        syncQueueStore.createIndex('sequenceNumber', 'sequenceNumber', { unique: false });
    }
}

/**
 * Migration to version 3: offlineAuth store for secure session storage.
 * Replaces localStorage for auth session.
 */


// function migrateToV2(db: IDBDatabase) {
//     // Reuse the v1 migration logic because it is idempotent.
//     migrateToV1(db);
// }

/**
 * Migration to version 3: offlineAuth store for secure session storage.
 * Replaces localStorage for auth session — not readable in DevTools App panel.
 */
function migrateToV3(db: IDBDatabase) {
    if (!db.objectStoreNames.contains('offlineAuth')) {
        db.createObjectStore('offlineAuth', { keyPath: 'key' });
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
// const DB_NAME = 'retailstack_pos';
// const DB_VERSION = 2; // Increment on schema changes

// export interface IndexedDBConfig {
//     dbName: string;
//     version: number;
// }

// /**
//  * Initialize IndexedDB connection with migration support.
//  */
// const REQUIRED_STORE_NAMES = ['products', 'sales', 'inventory', 'categories', 'syncMeta', 'syncQueue'];

// export function openDatabase(config: IndexedDBConfig = { dbName: DB_NAME, version: DB_VERSION }): Promise<IDBDatabase> {
//     return new Promise((resolve, reject) => {
//         const request = indexedDB.open(config.dbName, config.version);

//         request.onerror = () => reject(request.error);
//         request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
//             const db = (event.target as IDBOpenDBRequest).result;
//             const oldVersion = event.oldVersion;

//             // Migration path: v0 -> v1
//             if (oldVersion < 1) {
//                 migrateToV1(db);
//             }

//             // Migration path: v1 -> v2
//             if (oldVersion < 2) {
//                 migrateToV2(db);
//             }

//             // Add future migrations here
//             // if (oldVersion < 3) {
//             //   migrateToV3(db);
//             // }
//         };

//         request.onsuccess = async () => {
//             const db = request.result;
//             if (!hasRequiredStores(db)) {
//                 const currentVersion = db.version;
//                 db.close();
//                 try {
//                     const repaired = await repairDatabase(config, currentVersion);
//                     resolve(repaired);
//                     return;
//                 } catch (error) {
//                     reject(error);
//                     return;
//                 }
//             }
//             resolve(db);
//         };
//     });
// }

// function hasRequiredStores(db: IDBDatabase): boolean {
//     return REQUIRED_STORE_NAMES.every((name) => db.objectStoreNames.contains(name));
// }

// function repairDatabase(config: IndexedDBConfig, currentVersion: number): Promise<IDBDatabase> {
//     const repairVersion = Math.max(config.version + 1, currentVersion + 1);
//     return new Promise((resolve, reject) => {
//         const repairRequest = indexedDB.open(config.dbName, repairVersion);

//         repairRequest.onerror = () => reject(repairRequest.error);
//         repairRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
//             const db = (event.target as IDBOpenDBRequest).result;
//             migrateToV1(db);
//             migrateToV2(db);
//         };
//         repairRequest.onsuccess = () => resolve(repairRequest.result);
//     });
// }

// /**
//  * Migration to version 1: Create initial object stores.
//  */
// function migrateToV1(db: IDBDatabase) {
//     // Products store
//     if (!db.objectStoreNames.contains('products')) {
//         const productsStore = db.createObjectStore('products', { keyPath: 'id' });
//         productsStore.createIndex('tenantId', 'tenantId', { unique: false });
//         productsStore.createIndex('syncStatus', 'meta.syncStatus', { unique: false });
//     }

//     // Sales store
//     if (!db.objectStoreNames.contains('sales')) {
//         const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
//         salesStore.createIndex('tenantId', 'tenantId', { unique: false });
//         salesStore.createIndex('syncStatus', 'meta.syncStatus', { unique: false });
//     }

//     // Inventory store
//     if (!db.objectStoreNames.contains('inventory')) {
//         const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id' });
//         inventoryStore.createIndex('tenantId', 'tenantId', { unique: false });
//         inventoryStore.createIndex('syncStatus', 'meta.syncStatus', { unique: false });
//     }

//     // Categories store
//     if (!db.objectStoreNames.contains('categories')) {
//         const categoriesStore = db.createObjectStore('categories', { keyPath: 'id' });
//         categoriesStore.createIndex('tenantId', 'tenantId', { unique: false });
//         categoriesStore.createIndex('syncStatus', 'meta.syncStatus', { unique: false });
//     }

//     // Sync metadata store (stores last sync state)
//     if (!db.objectStoreNames.contains('syncMeta')) {
//         db.createObjectStore('syncMeta', { keyPath: 'key' });
//     }
// }

// /**
//  * Migration to version 2: Ensure any missing stores from the initial schema are created.
//  */
// function migrateToV2(db: IDBDatabase) {
//     // Reuse the v1 migration logic because it is idempotent.
//     migrateToV1(db);

//     // Create the syncQueue store if it doesn't exist.
//     // This store is owned by SyncQueue.ts but must be declared here
//     // because db.ts controls the canonical schema version.
//     // SyncQueue.ts opens the same database — it must never open at a
//     // lower version number or the browser will block it.
//     if (!db.objectStoreNames.contains('syncQueue')) {
//         const syncQueueStore = db.createObjectStore('syncQueue', {
//             keyPath: 'idempotencyKey',
//         });
//         syncQueueStore.createIndex('state', 'state', { unique: false });
//         syncQueueStore.createIndex('sequenceNumber', 'sequenceNumber', { unique: false });
//     }
// }
// // function migrateToV2(db: IDBDatabase) {
// //     // Reuse the v1 migration logic because it is idempotent.
// //     migrateToV1(db);
// // }

// /**
//  * Get a transaction for reading data.
//  */
// export async function readTransaction(
//     db: IDBDatabase,
//     storeName: string,
//     mode: 'readonly' | 'readwrite' = 'readonly'
// ): Promise<IDBObjectStore> {
//     return db.transaction(storeName, mode).objectStore(storeName);
// }

// /**
//  * Get all records from a store.
//  */
// export async function getAllFromStore(db: IDBDatabase, storeName: string): Promise<any[]> {
//     return new Promise((resolve, reject) => {
//         const transaction = db.transaction(storeName, 'readonly');
//         const store = transaction.objectStore(storeName);
//         const request = store.getAll();

//         request.onerror = () => reject(request.error);
//         request.onsuccess = () => resolve(request.result);
//     });
// }

// /**
//  * Get a single record by ID.
//  */
// export async function getFromStore(db: IDBDatabase, storeName: string, id: string): Promise<any> {
//     return new Promise((resolve, reject) => {
//         const transaction = db.transaction(storeName, 'readonly');
//         const store = transaction.objectStore(storeName);
//         const request = store.get(id);

//         request.onerror = () => reject(request.error);
//         request.onsuccess = () => resolve(request.result);
//     });
// }

// /**
//  * Put a record in a store (creates or updates).
//  */
// export async function putInStore(db: IDBDatabase, storeName: string, item: any): Promise<string> {
//     return new Promise((resolve, reject) => {
//         const transaction = db.transaction(storeName, 'readwrite');
//         const store = transaction.objectStore(storeName);
//         const request = store.put(item);

//         request.onerror = () => reject(request.error);
//         request.onsuccess = () => resolve(request.result as string);
//     });
// }

// /**
//  * Delete a record from a store.
//  */
// export async function deleteFromStore(db: IDBDatabase, storeName: string, id: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//         const transaction = db.transaction(storeName, 'readwrite');
//         const store = transaction.objectStore(storeName);
//         const request = store.delete(id);

//         request.onerror = () => reject(request.error);
//         request.onsuccess = () => resolve();
//     });
// }

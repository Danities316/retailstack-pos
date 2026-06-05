/// <reference lib="webworker" />

// Note: Workbox imports require: npm install workbox-precache workbox-routing workbox-strategies workbox-expiration workbox-cacheable-response
// Service Worker skeleton provided. Install Workbox and uncomment imports for production use.

import { openDatabase } from '@/offline/db'

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAMES = {
    precache: 'precache-v1',
    runtime: 'runtime-v1',
    api: 'api-v1',
};

/**
 * To enable caching strategies, install Workbox:
 * npm install workbox-precache workbox-routing workbox-strategies workbox-expiration workbox-cacheable-response
 * Then uncomment the code below.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

precacheAndRoute(self.__WB_MANIFEST as any || []);
cleanupOutdatedCaches();

registerRoute(
    ({ request }: any) => {
        return (
            request.destination === 'script' ||
            request.destination === 'style' ||
            request.destination === 'font' ||
            request.destination === 'image'
        );
    },
    new CacheFirst({
        cacheName: CACHE_NAMES.precache,
        plugins: [
            new ExpirationPlugin({
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
            }),
        ],
    })
);

registerRoute(
    ({ url, request }: any) => url.pathname.startsWith('/api/') && request.method === 'GET',
    new StaleWhileRevalidate({
        cacheName: CACHE_NAMES.api,
        plugins: [
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
            new ExpirationPlugin({
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
            }),
        ],
    })
);

registerRoute(
    ({ request }: any) => request.destination === 'document',
    new StaleWhileRevalidate({
        cacheName: CACHE_NAMES.runtime,
        plugins: [
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
        ],
    })
);

const navigationRoute = new NavigationRoute(
    new NetworkFirst({
        cacheName: CACHE_NAMES.runtime,
        networkTimeoutSeconds: 5,
    }),
    {
        denylist: [/^\/api\//],
    }
);

registerRoute(navigationRoute);
/**
 * Message handler: allow clients to control SW behavior.
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        event.waitUntil(self.skipWaiting());
    }
    if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ type: 'SW_ACK' });
    }
});

/**
 * Background sync: replay pending sales stored in IndexedDB.
 * Listens for a sync event with tag 'sync-sales'. This is a best-effort
 * replay: it will attempt to POST each dirty sale and remove it on success.
 */
self.addEventListener('sync', (event: any) => {
    if (event.tag === 'sync-sales') {
        event.waitUntil(replayPendingSales())
    }
});

async function replayPendingSales() {
    try {
        // Access IndexedDB using the shared schema migration helper.
        const db = await openDatabase()

        // Get all sales from IndexedDB
        const allSales = await new Promise<any[]>((resolve, reject) => {
            const transaction = db.transaction('sales', 'readonly')
            const store = transaction.objectStore('sales')
            const request = store.getAll()
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)
        })

        const pending = (allSales || []).filter((s: any) => s.meta && s.meta.syncStatus === 'DIRTY')

        if (!pending || pending.length === 0) return

        // Notify all open clients (windows) to perform the replay using their fresh auth tokens.
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clientList) {
            client.postMessage({ type: 'REPLAY_SALES', sales: pending })
        }
    } catch (err) {
        console.error('[SW] replayPendingSales failed', err)
    }
}

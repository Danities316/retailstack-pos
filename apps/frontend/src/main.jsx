import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeSyncQueue } from '@/offline/SyncQueue'
import { initOfflineAuth } from '@/lib/offlineAuth'
import { registerSW } from 'virtual:pwa-register'

// ── Service Worker registration ───────────────────────────────────────────────
// Updates automatically when a new version is deployed.
// The SW handles caching and PWA offline shell only.
// It does NOT replay sales — that is the sync queue's job.
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true)
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use')
  },
})

// ── Connectivity logging ──────────────────────────────────────────────────────
// Sync is triggered by useSyncManager inside the app, not here.
// This listener is for logging only.
window.addEventListener('online', () => {
  console.log('[Network] Device came online — sync will trigger automatically')
})

window.addEventListener('offline', () => {
  console.log('[Network] Device went offline — sales will queue locally')
})

// ── Boot sequence ─────────────────────────────────────────────────────────────
// initializeSyncQueue() is the ONLY boot-time queue loader.
// It reads from the syncQueue IndexedDB store — the single source of truth
// for all pending mutations. There is no second loader, no parallel path,
// and no SW message handler that bypasses this queue.
//
// WHY: Previously, initializeOfflineQueue() also loaded from the 'sales'
// store and enqueued items separately. Combined with initializeSyncQueue(),
// the same offline sale was enqueued twice on every boot, causing duplicate
// sale records on the server. The SW REPLAY_SALES message handler added a
// third submission path using a different idempotency key format, bypassing
// the queue's deduplication entirely. All of that is removed.
//
// The sync queue is the single writer. Nothing else submits sales to the server.

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

initializeSyncQueue()
  .then(() => initOfflineAuth())
  .then(() => renderApp())
  .catch((err) => {
    console.error('[Boot] Startup init failed, rendering anyway:', err)
    // Degrade gracefully — app still works online without queue/auth cache
    renderApp()
  })



// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.jsx'
// import { initializeSyncQueue } from '@/offline/SyncQueue'
// import { registerSW } from 'virtual:pwa-register'

// // ── Service Worker registration ───────────────────────────────────────────────
// // Updates automatically when a new version is deployed.
// // The SW handles caching and PWA offline shell only.
// // It does NOT replay sales — that is the sync queue's job.
// const updateSW = registerSW({
//   onNeedRefresh() {
//     updateSW(true)
//   },
//   onOfflineReady() {
//     console.log('[PWA] App ready for offline use')
//   },
// })

// // ── Connectivity logging ──────────────────────────────────────────────────────
// // Sync is triggered by useSyncManager inside the app, not here.
// // This listener is for logging only.
// window.addEventListener('online', () => {
//   console.log('[Network] Device came online — sync will trigger automatically')
// })

// window.addEventListener('offline', () => {
//   console.log('[Network] Device went offline — sales will queue locally')
// })

// // ── Boot sequence ─────────────────────────────────────────────────────────────
// // initializeSyncQueue() is the ONLY boot-time queue loader.
// // It reads from the syncQueue IndexedDB store — the single source of truth
// // for all pending mutations. There is no second loader, no parallel path,
// // and no SW message handler that bypasses this queue.
// //
// // WHY: Previously, initializeOfflineQueue() also loaded from the 'sales'
// // store and enqueued items separately. Combined with initializeSyncQueue(),
// // the same offline sale was enqueued twice on every boot, causing duplicate
// // sale records on the server. The SW REPLAY_SALES message handler added a
// // third submission path using a different idempotency key format, bypassing
// // the queue's deduplication entirely. All of that is removed.
// //
// // The sync queue is the single writer. Nothing else submits sales to the server.

// initializeSyncQueue().then(() => {
//   createRoot(document.getElementById('root')).render(
//     <StrictMode>
//       <App />
//     </StrictMode>
//   )
// }).catch((err) => {
//   console.error('[Boot] Failed to initialize sync queue:', err)
//   // Render anyway — the app degrades gracefully without the queue
//   createRoot(document.getElementById('root')).render(
//     <StrictMode>
//       <App />
//     </StrictMode>
//   )
// })



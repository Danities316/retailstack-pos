import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Load pending offline sales from IndexedDB into the sync queue on app boot
async function initializeOfflineQueue() {
  try {
    const { openDatabase, getAllFromStore } = await import('@/offline/db')
    const { globalSyncQueue } = await import('@/offline/SyncQueue')

    const db = await openDatabase()
    const allSales = await getAllFromStore(db, 'sales')
    const pending = (allSales || []).filter((s) => s.meta && s.meta.syncStatus === 'DIRTY')

    if (pending.length > 0) {
      console.log('[Offline] Loading', pending.length, 'pending sales into sync queue')
      // Convert persisted sale format to SyncQueueItem format
      for (const sale of pending) {
        globalSyncQueue.enqueue(
          sale.id,
          'sales',
          'CREATE',
          sale.data,
          0,
          1
        )
      }
      console.log('[Offline] Sync queue initialized with pending sales')
    }
  } catch (err) {
    console.warn('[Offline] Failed to load pending sales on app boot', err)
  }
}

// Register Service Worker (only in production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      // Check that /sw.js actually exists and is served as JavaScript
      const headResponse = await fetch('/sw.js', { method: 'HEAD' })
      const contentType = headResponse.headers.get('content-type') || ''
      if (!headResponse.ok || !contentType.includes('javascript')) {
        console.warn('Service Worker not available at /sw.js or wrong MIME type. Skipping registration.')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        type: 'module'
      })
      console.log('Service Worker registered successfully:', registration)
    } catch (error) {
      console.warn('Service Worker registration failed:', error)
    }
  })
}

// Initialize offline queue on app startup
initializeOfflineQueue()

// Listen for when device comes back online
window.addEventListener('online', async () => {
  console.log('[Offline] Device came online')
  // NOTE: automatic sync via executeSyncCycle triggers isSync() stack overflow.
  // Relying on: 1) SW background sync, 2) Outbox manual retry, 3) client SW replay via postMessage
})

// Handle messages from the Service Worker (e.g., replay pending sales)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (event) => {
    try {
      const data = event.data || {}
      if (data.type === 'REPLAY_SALES' && Array.isArray(data.sales)) {
        const sales = data.sales
        const baseURL = import.meta.env.VITE_API_BASE_URL || ''
        const token = localStorage.getItem('auth_token')

        // Lazy import DB helpers to remove entries after successful replay
        const { openDatabase, deleteFromStore } = await import('@/offline/db')
        const db = await openDatabase()

        for (const sale of sales) {
          try {
            const headers = {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
              'Idempotency-Key': sale.id,
            }

            const res = await fetch(`${baseURL}/sales`, {
              method: 'POST',
              headers,
              body: JSON.stringify(sale.data),
            })

            if (res && res.ok) {
              // Delete from local store after successful replay
              try {
                await deleteFromStore(db, 'sales', sale.id)
              } catch (e) {
                console.warn('Failed to remove replayed sale from IDB', sale.id, e)
              }
            }
          } catch (err) {
            console.error('Failed to replay sale from client', sale.id, err)
          }
        }
      }
    } catch (err) {
      console.error('Error handling SW message', err)
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

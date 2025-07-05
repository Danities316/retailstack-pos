import { offlineDB } from '@/lib/indexedDB'

class SyncService {
  private isSyncing = false
  private syncInterval: NodeJS.Timeout | null = null

  async startBackgroundSync() {
    // Sync every 5 minutes when online
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine && !this.isSyncing) {
        await this.syncData()
      }
    }, 5 * 60 * 1000)

    // Listen for network online events
    window.addEventListener('networkOnline', () => {
      this.syncData()
    })
  }

  async syncData() {
    if (this.isSyncing) return

    this.isSyncing = true
    try {
      const queue = await offlineDB.getSyncQueue()
      
      for (const item of queue) {
        await this.processSyncItem(item)
      }

      // Sync local data with server
      await this.syncLocalData()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      this.isSyncing = false
    }
  }

  private async processSyncItem(item: any) {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch(`https://retailstack-pos.onrender.com/api/${item.entity}`, {
        method: item.action === 'DELETE' ? 'DELETE' : 
                item.action === 'CREATE' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: item.action !== 'DELETE' ? JSON.stringify(item.data) : undefined
      })

      if (response.ok) {
        await offlineDB.removeFromSyncQueue(item.id)
      } else {
        // Increment retry count
        item.retries++
        if (item.retries > 3) {
          await offlineDB.removeFromSyncQueue(item.id)
        }
      }
    } catch (error) {
      console.error(`Failed to sync ${item.entity}:`, error)
    }
  }

  private async syncLocalData() {
    // Sync products, sales, etc. from server to local
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      // Sync products
      const productsResponse = await fetch('https://retailstack-pos.onrender.com/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (productsResponse.ok) {
        const products = await productsResponse.json()
        for (const product of products) {
          await offlineDB.saveProduct(product)
        }
      }

      // Sync sales
      const salesResponse = await fetch('https://retailstack-pos.onrender.com/api/sales', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (salesResponse.ok) {
        const sales = await salesResponse.json()
        for (const sale of sales) {
          await offlineDB.saveSale(sale)
        }
      }
    } catch (error) {
      console.error('Failed to sync local data:', error)
    }
  }

  stopBackgroundSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }
}

export const syncService = new SyncService()
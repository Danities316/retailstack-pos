import { openDB, DBSchema, IDBPDatabase, deleteDB } from 'idb'

interface RetailStackDB extends DBSchema {
  users: {
    key: string
    value: {
      id: string
      email: string
      role: string
      tenantId: string
      lastSync: number
    }
  }
  categories: {
    key: string
    value: {
      id: string
      categoryName: string
      tenantId: string
      lastSync: number
      isOffline: boolean
    }
    indexes: { 'by-tenant': string }
  }
  products: {
    key: string
    value: {
      id: string
      productName: string
      sellingPrice: number
      costPrice: number
      stock: number
      categoryId?: string
      tenantId: string
      lastSync: number
      isOffline: boolean
    }
    indexes: { 'by-tenant': string }
  }
  sales: {
    key: string
    value: {
      id: string
      totalAmount: number
      paymentMethod: string
      tenantId: string
      items: Array<{
        productId: string
        quantity: number
        price: number
      }>
      createdAt: number
      lastSync: number
      isOffline: boolean
    }
    indexes: { 'by-tenant': string }
  }
  syncQueue: {
    key: string
    value: {
      id: string
      action: 'CREATE' | 'UPDATE' | 'DELETE'
      entity: 'product' | 'sale' | 'user' | 'category'
      data: any
      timestamp: number
      retries: number
    }
  }
  dashboardStats: {
    key: string // tenantId
    value: {
      tenantId: string
      stats: any
      lastSync: number
    }
  }
  salesChartData: {
    key: string // cacheKey (tenantId_range)
    value: {
      cacheKey: string
      data: any
      lastSync: number
    }
  }
  recentSalesData: {
    key: string // tenantId
    value: {
      tenantId: string
      data: any
      lastSync: number
    }
  }
}

class OfflineDB {
  private db: IDBPDatabase<RetailStackDB> | null = null

  async init(): Promise<void> {
    try {
      this.db = await openDB<RetailStackDB>('retailstack-db', 2, {
        upgrade(db, oldVersion, newVersion) {
          console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`)
          
          // Users store
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id' })
          }

          // Categories store
          if (!db.objectStoreNames.contains('categories')) {
            const categoryStore = db.createObjectStore('categories', { keyPath: 'id' })
            categoryStore.createIndex('by-tenant', 'tenantId')
          }

          // Products store
          if (!db.objectStoreNames.contains('products')) {
            const productStore = db.createObjectStore('products', { keyPath: 'id' })
            productStore.createIndex('by-tenant', 'tenantId')
          }

          // Sales store
          if (!db.objectStoreNames.contains('sales')) {
            const saleStore = db.createObjectStore('sales', { keyPath: 'id' })
            saleStore.createIndex('by-tenant', 'tenantId')
          }

          // Sync queue store
          if (!db.objectStoreNames.contains('syncQueue')) {
            db.createObjectStore('syncQueue', { keyPath: 'id' })
          }

          // Dashboard stats store
          if (!db.objectStoreNames.contains('dashboardStats')) {
            db.createObjectStore('dashboardStats', { keyPath: 'tenantId' })
          }

          // Sales chart data store
          if (!db.objectStoreNames.contains('salesChartData')) {
            db.createObjectStore('salesChartData', { keyPath: 'cacheKey' })
          }

          // Recent sales data store
          if (!db.objectStoreNames.contains('recentSalesData')) {
            db.createObjectStore('recentSalesData', { keyPath: 'tenantId' })
          }
        }
      })
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error)
      // If there's a version conflict, try to delete and recreate the database
      if (error instanceof Error && error.name === 'VersionError') {
        console.log('Version conflict detected, clearing database...')
        await this.clearDatabase()
        return this.init()
      }
      throw error
    }
  }

  async clearDatabase() {
    try {
      await deleteDB('retailstack-db')
      this.db = null
      console.log('Database cleared successfully')
    } catch (error) {
      console.error('Failed to clear database:', error)
    }
  }

  // User operations
  async saveUser(user: any) {
    if (!this.db) await this.init()
    await this.db!.put('users', {
      ...user,
      lastSync: Date.now()
    })
  }

  async getUser(id: string) {
    if (!this.db) await this.init()
    return await this.db!.get('users', id)
  }

  // Category operations
  async saveCategory(category: any) {
    if (!this.db) await this.init()
    await this.db!.put('categories', {
      ...category,
      lastSync: Date.now()
    })
  }

  async getCategories(tenantId: string) {
    if (!this.db) await this.init()
    return await this.db!.getAllFromIndex('categories', 'by-tenant', tenantId)
  }

  // Product operations
  async saveProduct(product: any) {
    if (!this.db) await this.init()
    await this.db!.put('products', {
      ...product,
      lastSync: Date.now()
    })
  }

  async getProducts(tenantId: string) {
    if (!this.db) await this.init()
    return await this.db!.getAllFromIndex('products', 'by-tenant', tenantId)
  }

  // Sales operations
  async saveSale(sale: any) {
    if (!this.db) await this.init()
    await this.db!.put('sales', {
      ...sale,
      lastSync: Date.now()
    })
  }

  async getSales(tenantId: string) {
    if (!this.db) await this.init()
    return await this.db!.getAllFromIndex('sales', 'by-tenant', tenantId)
  }

  // Sync queue operations
  async addToSyncQueue(action: 'CREATE' | 'UPDATE' | 'DELETE', entity: 'product' | 'sale' | 'user' | 'category', data: any) {
    if (!this.db) await this.init()
    await this.db!.add('syncQueue', {
      id: `${entity}-${Date.now()}-${Math.random()}`,
      action,
      entity,
      data,
      timestamp: Date.now(),
      retries: 0
    })
  }

  async getSyncQueue() {
    if (!this.db) await this.init()
    return await this.db!.getAll('syncQueue')
  }

  async removeFromSyncQueue(id: string) {
    if (!this.db) await this.init()
    await this.db!.delete('syncQueue', id)
  }

  // Dashboard stats operations
  async saveDashboardStats(tenantId: string, stats: any) {
    if (!this.db) await this.init()
    await this.db!.put('dashboardStats', {
      tenantId,
      stats,
      lastSync: Date.now(),
    })
  }

  async getDashboardStats(tenantId: string) {
    if (!this.db) await this.init()
    const entry = await this.db!.get('dashboardStats', tenantId)
    return entry ? entry.stats : null
  }

  // Sales chart data operations
  async saveSalesChartData(cacheKey: string, data: any) {
    if (!this.db) await this.init()
    await this.db!.put('salesChartData', {
      cacheKey,
      data,
      lastSync: Date.now(),
    })
  }

  async getSalesChartData(cacheKey: string) {
    if (!this.db) await this.init()
    const entry = await this.db!.get('salesChartData', cacheKey)
    return entry ? entry.data : []
  }

  // Recent sales data operations
  async saveRecentSalesData(tenantId: string, data: any) {
    if (!this.db) await this.init()
    await this.db!.put('recentSalesData', {
      tenantId,
      data,
      lastSync: Date.now(),
    })
  }

  async getRecentSalesData(tenantId: string) {
    if (!this.db) await this.init()
    const entry = await this.db!.get('recentSalesData', tenantId)
    return entry ? entry.data : []
  }
}

export const offlineDB = new OfflineDB()

// Expose for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).clearRetailStackDB = () => offlineDB.clearDatabase()
}
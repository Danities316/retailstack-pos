import { offlineDB } from './indexedDB'
import { syncService } from '@/services/syncService'

class ApiClient {
  private baseURL = 'http://localhost:3000/api'

  async request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('auth_token')
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config)
      
      if (response.ok) {
        return await response.json()
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      // If offline, queue the request for later sync
      if (!navigator.onLine) {
        await this.queueOfflineRequest(endpoint, options)
        throw new Error('Request queued for offline sync')
      }
      throw error
    }
  }

  private async queueOfflineRequest(endpoint: string, options: RequestInit) {
    const entityPath = endpoint.split('/')[1] // Extract entity from endpoint
    // Map plural forms to singular for sync queue
    const entityMap: Record<string, 'product' | 'sale' | 'user' | 'category'> = {
      'products': 'product',
      'sales': 'sale',
      'users': 'user',
      'categories': 'category'
    }
    const entity = entityPath ? entityMap[entityPath] || 'product' : 'product'
    
    const action = options.method === 'POST' ? 'CREATE' as const : 
                   options.method === 'PUT' ? 'UPDATE' as const : 'DELETE' as const

    await offlineDB.addToSyncQueue(action, entity, {
      endpoint,
      ...options
    })
  }

  // Product methods
  async getProducts() {
    if (navigator.onLine) {
      const products = await this.request('/products')
      // Cache products locally
      for (const product of products) {
        await offlineDB.saveProduct(product)
      }
      return products
    } else {
      // Return cached products
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
      return await offlineDB.getProducts(user.tenantId)
    }
  }

  async createProduct(productData: any) {
    if (navigator.onLine) {
      const product = await this.request('/products', {
        method: 'POST',
        body: JSON.stringify(productData)
      })
      await offlineDB.saveProduct(product)
      return product
    } else {
      // Create offline product
      const offlineProduct = {
        id: `offline-${Date.now()}`,
        ...productData,
        isOffline: true
      }
      await offlineDB.saveProduct(offlineProduct)
      await offlineDB.addToSyncQueue('CREATE', 'product', productData)
      return offlineProduct
    }
  }

  // Category methods
  async getCategories() {
    if (navigator.onLine) {
      const categories = await this.request('/categories')
      // Cache categories locally
      for (const category of categories) {
        await offlineDB.saveCategory(category)
      }
      return categories
    } else {
      // Return cached categories
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
      return await offlineDB.getCategories(user.tenantId)
    }
  }

  async createCategory(categoryData: any) {
    if (navigator.onLine) {
      const category = await this.request('/categories', {
        method: 'POST',
        body: JSON.stringify(categoryData)
      })
      await offlineDB.saveCategory(category)
      return category
    } else {
      // Create offline category
      const offlineCategory = {
        id: `offline-${Date.now()}`,
        ...categoryData,
        isOffline: true
      }
      await offlineDB.saveCategory(offlineCategory)
      await offlineDB.addToSyncQueue('CREATE', 'category', categoryData)
      return offlineCategory
    }
  }

  // Sales methods
  async createSale(saleData: any) {
    if (navigator.onLine) {
      const sale = await this.request('/sales', {
        method: 'POST',
        body: JSON.stringify(saleData)
      })
      await offlineDB.saveSale(sale)
      return sale
    } else {
      // Create offline sale
      const offlineSale = {
        id: `offline-${Date.now()}`,
        ...saleData,
        isOffline: true
      }
      await offlineDB.saveSale(offlineSale)
      await offlineDB.addToSyncQueue('CREATE', 'sale', saleData)
      return offlineSale
    }
  }

  // Dashboard stats methods
  async getDashboardStats(tenantId: string, token?: string) {
    if (navigator.onLine) {
      const stats = await this.request('/dashboard/quick-stats', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-tenant-id': tenantId,
        },
      })
      await offlineDB.saveDashboardStats(tenantId, stats)
      return stats
    } else {
      return await offlineDB.getDashboardStats(tenantId)
    }
  }

  // Sales chart methods
  async getSalesChartData(tenantId: string, range: string, token?: string) {
    const cacheKey = `${tenantId}_${range}`;
    if (navigator.onLine) {
      const result = await this.request(`/dashboard/sales-chart?range=${range}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-tenant-id': tenantId,
        },
      })
      if (result && result.data) {
        await offlineDB.saveSalesChartData(cacheKey, result.data)
        return result.data
      }
      return []
    } else {
      return await offlineDB.getSalesChartData(cacheKey)
    }
  }

  // Recent sales methods
  async getRecentSalesData(tenantId: string, token?: string) {
    if (navigator.onLine) {
      const result = await this.request(`/dashboard/recent-sales?limit=5`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-tenant-id': tenantId,
        },
      })
      if (result && result.data) {
        await offlineDB.saveRecentSalesData(tenantId, result.data)
        return result.data
      }
      return []
    } else {
      return await offlineDB.getRecentSalesData(tenantId)
    }
  }
}

export const apiClient = new ApiClient()
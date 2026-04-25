class ApiClient {
  private baseURL = import.meta.env.VITE_API_BASE_URL
  private isRefreshing = false
  private refreshSubscribers: Array<(token: string) => void> = []

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token))
    this.refreshSubscribers = []
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback)
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      this.clearAuth()
      return null
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const { accessToken, refreshToken: newRefreshToken } = data.data || data

        if (accessToken) {
          localStorage.setItem('auth_token', accessToken)
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken)
          }
          this.onRefreshed(accessToken)
          return accessToken
        }
      }

      // Refresh failed, clear auth and redirect to login
      this.clearAuth()
      window.location.href = '/login'
      return null
    } catch (error) {
      console.error('Token refresh failed:', error)
      this.clearAuth()
      window.location.href = '/login'
      return null
    }
  }

  private clearAuth() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    localStorage.removeItem('tenant')
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('auth_token')

    // Build headers carefully: do not force JSON content-type for FormData uploads
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    }

    // Add Authorization header (unless already provided)
    if (!headers['Authorization'] && token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Only set Content-Type to JSON when body is not FormData and no explicit Content-Type provided
    const body = options.body as any
    if (!headers['Content-Type'] && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    const config: RequestInit = {
      ...options,
      headers,
    }

    try {
      console.log(`API Request: ${endpoint}`, config)
      let response = await fetch(`${this.baseURL}${endpoint}`, config)

      // Handle 401 Unauthorized - attempt token refresh
      if (response.status === 401 && !this.isRefreshing) {
        this.isRefreshing = true
        const newToken = await this.refreshAccessToken()
        this.isRefreshing = false

        if (newToken) {
          // Retry the original request with new token
          const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
          const retryConfig: RequestInit = { ...options, headers: retryHeaders }
          response = await fetch(`${this.baseURL}${endpoint}`, retryConfig)
        }
      } else if (response.status === 401 && this.isRefreshing) {
        // Token refresh is in progress, wait for it to complete
        return new Promise((resolve, reject) => {
          this.addRefreshSubscriber((token: string) => {
            const retryHeaders = { ...headers, Authorization: `Bearer ${token}` }
            const retryConfig: RequestInit = { ...options, headers: retryHeaders }
            fetch(`${this.baseURL}${endpoint}`, retryConfig)
              .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}: ${res.statusText}`)))
              .then(resolve)
              .catch(reject)
          })
        })
      }
      console.log(`API Request: ${endpoint}`, config, 'Response:', response)

      if (response.ok) {
        const data = await response.json()
        return data
      } else {
        // Try to parse error response to get detailed error info
        let errorData: any = { status: response.status, statusText: response.statusText }
        try {
          const body = await response.json()
          errorData = { ...errorData, ...body }
        } catch {
          // If response body is not JSON, just use status info
        }

        // Create error with all details
        const error: any = new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`)
        error.code = errorData.code
        error.status = response.status
        error.details = errorData
        throw error
      }
    } catch (error) {
      throw error
    }
  }

  // Product methods
  async getProducts() {
    return await this.request('/products')
  }

  async createProduct(productData: any) {
    return await this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    })
  }

  /**
   * Search products for the POS terminal.
   * Calls GET /api/products/search?query=...
   */
  async searchProducts(query: string) {
    const endpoint = `/products/search?query=${encodeURIComponent(query)}`
    console.log("endpoint:", endpoint);
    return await this.request(endpoint)
  }

  // Category methods
  async getCategories() {
    return await this.request('/categories')
  }

  async createCategory(categoryData: any) {
    return await this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    })
  }

  // Sales methods
  async createSale(saleData: any) {
    try {
      return await this.request('/sales', {
        method: 'POST',
        body: JSON.stringify(saleData)
      })
    } catch (err: any) {
      // Check if this is a business logic error that should NOT fall back to offline
      // Business logic errors should be handled by the UI, not persisted offline
      if (err.status === 402 || err.code === 'SHIFT_REQUIRED') {
        // Re-throw shift-required errors so frontend can show the clock-in modal
        throw err
      }

      if (err.status === 400 || err.status === 409 || err.status === 403) {
        // Re-throw validation and auth errors - don't fallback to offline
        throw err
      }

      // Network or other failure -> fallback to offline outbox
      console.warn('[Offline] Network request failed, attempting to persist to IndexedDB', err.message)

      try {
        // Lazy import to avoid pulling IDB logic into environments that don't have window/indexedDB
        const { openDatabase, putInStore } = await import('@/offline/db')
        const { globalSyncQueue } = await import('@/offline/SyncQueue')

        const db = await openDatabase()
        const id = `local_sale_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const entity = {
          id,
          tenantId: (saleData && saleData.tenantId) || '',
          data: saleData,
          meta: {
            version: 0,
            syncStatus: 'DIRTY',
            lastModifiedAt: new Date().toISOString(),
          },
        }

        await putInStore(db, 'sales', entity)
        globalSyncQueue.enqueue(id, 'sales', 'CREATE', saleData, 0, 1)
        console.log('[Offline] Sale persisted to IndexedDB and enqueued', id)

        // Try to register a background sync (best-effort)
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready
            if (reg && 'sync' in reg) {
              // tag name 'sync-sales' consumed by SW to trigger replay
              await (reg as any).sync.register('sync-sales')
              console.log('[Offline] Background sync registered for sync-sales')
            }
          } catch (e) {
            console.warn('[Offline] Background sync registration failed', e)
          }
        }

        // ALWAYS return a local acknowledgement so UI can continue
        // This ensures the user experience is not disrupted by an offline state
        return { offline: true, id, data: entity }
      } catch (persistErr: any) {
        // If offline persistence itself failed, log it and still return a local ack
        // so the UI does not show "failed to fetch" when the user is offline
        console.error('[Offline] Failed to persist sale to IndexedDB', persistErr)

        // Generate a local ID anyway so the user knows the action was attempted
        const id = `local_sale_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        return {
          offline: true,
          id,
          data: saleData,
          persistenceError: persistErr.message
        }
      }
    }
  }

  // Dashboard stats methods
  async getDashboardStats(tenantId: string, token?: string) {
    return await this.request('/dashboard/quick-stats', {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'x-tenant-id': tenantId,
      },
    })
  }

  async getDailySummary(tenantId: string, token?: string) {
    return await this.request('/dashboard/daily-summary', {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'x-tenant-id': tenantId,
      },
    })
  }

  // Sales chart methods
  async getSalesChartData(tenantId: string, range: string, token?: string) {
    const result = await this.request(`/dashboard/sales-chart?range=${range}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'x-tenant-id': tenantId,
      },
    })
    return result.data || []
  }

  // Recent sales methods
  async getRecentSalesData(tenantId: string, token?: string) {
    const result = await this.request(`/dashboard/recent-sales?limit=5`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'x-tenant-id': tenantId,
      },
    })
    return result.data || []
  }


  // Shift methods
  async getActiveShift(): Promise<any | null> {
    // Calls GET /api/shifts/active-shift
    try {
      // Assuming a 404 response means no active shift
      return await this.request('/shifts/active-shift');
    } catch (error: any) {
      // Handle the case where the server returns a "not found" status (e.g., 404)
      // which would indicate no active shift for the user.
      if (error.message.includes('404') || error.message.includes('No active shift')) {
        return null;
      }
      throw error;
    }
  }

  async clockInShift(data: { startFloat: number }) {
    // Calls POST /api/shifts/clock-in
    return await this.request('/shifts/clock-in', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async clockOutShift(shiftId: string, data: { endFloat: number }) {
    console.log('clockOutShift called with:', shiftId, data);
    // Calls POST /api/shifts/clock-out/:id
    return await this.request(`/shifts/clock-out/${shiftId}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Manager Dashboard stats methods (Add this)
  async getManagerDashboardStats(tenantId: string, token?: string) {
    return await this.request('/dashboard/manager/manager-stats', {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'x-tenant-id': tenantId,
      },
    })
  }
  // Manager & Owner Dashboard stats methods (Add this)
  async getTopProducts(tenantId: string, token?: string, limit = 5) {
    return await this.request(`/dashboard/top-products?limit=${limit}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'x-tenant-id': tenantId,
      },
    })
  }
  async uploadProducts(file: File, tenantId: string, token: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    // CHANGE: 'response' here is actually the DATA returned by this.request, not the raw fetch response.
    try {
      const data = await this.request('/products/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': tenantId,
          // Reminder: Do not set Content-Type; the browser sets it for FormData
        },
        body: formData,
      });

      console.log("uploadProducts data received:", data);
      return data; // Return the data directly to the component

    } catch (error: any) {
      // If this.request fails, it throws an error. 
      // We catch it and throw a clean message for the UI.
      console.error("Upload error details:", error);
      throw new Error(error.report.errors[0].error || "Failed to upload products.");
    }
  }

  // HTTP helper methods for sync operations
  async post(endpoint: string, data: any = {}) {
    return await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async get(endpoint: string) {
    return await this.request(endpoint, {
      method: 'GET',
    });
  }

  async put(endpoint: string, data: any = {}) {
    return await this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string) {
    return await this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient()
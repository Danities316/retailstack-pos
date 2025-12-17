class ApiClient {
  private baseURL = import.meta.env.VITE_API_BASE_URL

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
      const response = await fetch(`${this.baseURL}${endpoint}`, config);


      if (response.ok) {
        const data = await response.json()
        return data
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
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
    return await this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData)
    })
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
}

export const apiClient = new ApiClient()
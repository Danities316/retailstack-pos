import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { mockProducts, mockCategories, mockSales } from '../__mocks__/apiClient'

// Mock fetch globally
global.fetch = vi.fn()

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('auth_token', 'test-token')
  })

  describe('request method', () => {
    it('should make successful API request', async () => {
      const mockResponse = { data: 'success' }
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await apiClient.request('/test')

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          })
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle API errors', async () => {
      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(apiClient.request('/test')).rejects.toThrow('HTTP 404: Not Found')
    })

    it('should handle network errors', async () => {
      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      await expect(apiClient.request('/test')).rejects.toThrow('Network error')
    })
  })

  describe('getProducts', () => {
    it('should fetch products successfully', async () => {
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProducts)
      })

      const result = await apiClient.getProducts()

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/products',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(mockProducts)
    })
  })

  describe('createProduct', () => {
    it('should create product successfully', async () => {
      const newProduct = {
        productName: 'New Product',
        sellingPrice: 100,
        costPrice: 80,
        stock: 10,
        categoryId: 'cat1'
      }

      const createdProduct = { id: '2', ...newProduct }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdProduct)
      })

      const result = await apiClient.createProduct(newProduct)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/products',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newProduct),
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(createdProduct)
    })
  })

  describe('getCategories', () => {
    it('should fetch categories successfully', async () => {
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCategories)
      })

      const result = await apiClient.getCategories()

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/categories',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(mockCategories)
    })
  })

  describe('createSale', () => {
    it('should create sale successfully', async () => {
      const saleData = {
        paymentMethod: 'CASH',
        items: [
          { productId: '1', quantity: 2, price: 100 }
        ],
        total: 200
      }

      const createdSale = { id: 'sale2', ...saleData }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdSale)
      })

      const result = await apiClient.createSale(saleData)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/sales',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(saleData),
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(createdSale)
    })
  })

  describe('getDashboardStats', () => {
    it('should fetch dashboard stats successfully', async () => {
      const mockStats = { totalSales: 1000, totalProducts: 50 }
      
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })

      const result = await apiClient.getDashboardStats('tenant1', 'test-token')

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/dashboard/quick-stats',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'x-tenant-id': 'tenant1'
          })
        })
      )
      expect(result).toEqual(mockStats)
    })
  })
})

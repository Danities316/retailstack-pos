import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/apiClient'

/**
 * Custom hook for Global Product Catalog operations
 * Provides search, lookup, contribution tracking, and sync functionality
 */

export interface GlobalProduct {
    id: string
    barcode: string
    productName: string
    description?: string
    imageUrl?: string
    createdAt: string
    updatedAt: string
    version: number
    contributedByTenant?: {
        id: string
        name: string
    }
    products?: Array<{
        id: string
        tenantId: string
        sellingPrice: string
    }>
}

export interface CatalogStats {
    totalProducts: number
    totalContributors: number
    recentAdditions: GlobalProduct[]
}

export interface CatalogSearchResult {
    query: string
    resultsCount: number
    results: GlobalProduct[]
}

/**
 * Hook for searching and looking up products in the global catalog
 */
export const useGlobalCatalogSearch = () => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const search = useCallback(async (query: string): Promise<GlobalProduct[] | null> => {
        if (!query || query.length < 2) {
            return null
        }

        setLoading(true)
        setError(null)

        try {
            const response: CatalogSearchResult = await apiClient.searchGlobalCatalog(query)
            return response.results || []
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to search global catalog'
            setError(errorMessage)
            console.error('Global catalog search failed:', err)
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    const searchByBarcode = useCallback(async (barcode: string): Promise<GlobalProduct | null> => {
        if (!barcode) {
            return null
        }

        setLoading(true)
        setError(null)

        try {
            const product: GlobalProduct = await apiClient.lookupGlobalCatalogByBarcode(barcode)
            return product
        } catch (err: any) {
            // 404 is expected if product not found
            if (err.status === 404) {
                return null
            }
            const errorMessage = err.message || 'Failed to lookup product'
            setError(errorMessage)
            console.error('Barcode lookup failed:', err)
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    return { search, searchByBarcode, loading, error }
}

/**
 * Hook for syncing products to the global catalog
 */
export const useGlobalCatalogSync = () => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const createProductWithSync = useCallback(async (productData: any): Promise<any> => {
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await apiClient.createProductWithGlobalSync(productData)
            setSuccess(response.message || 'Product created and synced to global catalog!')
            return response
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to create product'
            setError(errorMessage)
            console.error('Product creation failed:', err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [])

    const syncExistingProduct = useCallback(async (productId: string): Promise<any> => {
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await apiClient.syncProductToGlobalCatalog(productId)
            setSuccess(response.message || 'Product synced to global catalog!')
            return response
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to sync product'
            setError(errorMessage)
            console.error('Product sync failed:', err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [])

    return { createProductWithSync, syncExistingProduct, loading, error, success }
}

/**
 * Hook for viewing catalog statistics and contributions
 */
export const useGlobalCatalogStats = () => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const getStats = useCallback(async (): Promise<CatalogStats | null> => {
        setLoading(true)
        setError(null)

        try {
            const response = await apiClient.getGlobalCatalogStats()
            return response?.globalProductDatabase || null
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to fetch catalog stats'
            setError(errorMessage)
            console.error('Failed to fetch stats:', err)
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    const getContributions = useCallback(async (): Promise<any> => {
        setLoading(true)
        setError(null)

        try {
            return await apiClient.getTenantCatalogContributions()
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to fetch contributions'
            setError(errorMessage)
            console.error('Failed to fetch contributions:', err)
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    return { getStats, getContributions, loading, error }
}

/**
 * Main hook combining all global catalog functionality
 */
export const useGlobalCatalog = () => {
    const search = useGlobalCatalogSearch()
    const sync = useGlobalCatalogSync()
    const stats = useGlobalCatalogStats()

    return {
        search: search.search,
        searchByBarcode: search.searchByBarcode,
        createProductWithSync: sync.createProductWithSync,
        syncExistingProduct: sync.syncExistingProduct,
        getStats: stats.getStats,
        getContributions: stats.getContributions,
        loading: search.loading || sync.loading || stats.loading,
        error: search.error || sync.error || stats.error,
        success: sync.success,
    }
}

export default useGlobalCatalog

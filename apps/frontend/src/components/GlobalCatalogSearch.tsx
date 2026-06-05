import { useState, useCallback, useEffect } from 'react'
import { useGlobalCatalogSearch } from '@/hooks/useGlobalCatalog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface GlobalCatalogSearchProps {
    onProductFound?: (product: any) => void
    onProductNotFound?: () => void
    placeholder?: string
    className?: string
}

/**
 * Component for searching the global product catalog
 * Shows results and allows user to select or add product
 */
export const GlobalCatalogSearch = ({
    onProductFound,
    onProductNotFound,
    placeholder = 'Search products in community database...',
    className = ''
}: GlobalCatalogSearchProps) => {
    const [query, setQuery] = useState('')
    const [showResults, setShowResults] = useState(false)
    const { search, loading, error } = useGlobalCatalogSearch()
    const [results, setResults] = useState<any[]>([])

    const handleSearch = useCallback(async (searchQuery: string) => {
        setQuery(searchQuery)

        if (!searchQuery || searchQuery.length < 2) {
            setShowResults(false)
            setResults([])
            return
        }

        const searchResults = await search(searchQuery)
        if (searchResults) {
            setResults(searchResults)
            setShowResults(true)

            if (searchResults.length === 0 && onProductNotFound) {
                onProductNotFound()
            }
        }
    }, [search, onProductNotFound])

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="relative">
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="text-gray-800"
                />
                {loading && (
                    <div className="absolute right-3 top-3">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {error}
                </div>
            )}

            {showResults && results.length > 0 && (
                <div className="border border-gray-200 rounded-lg bg-white p-3 max-h-60 overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-600 mb-3">
                        Found {results.length} product{results.length !== 1 ? 's' : ''} in community database
                    </p>
                    <div className="space-y-2">
                        {results.map((product) => (
                            <div
                                key={product.id}
                                className="p-3 border border-gray-100 rounded hover:bg-blue-50 cursor-pointer transition"
                                onClick={() => {
                                    if (onProductFound) {
                                        onProductFound(product)
                                    }
                                    setShowResults(false)
                                    setQuery('')
                                }}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-800">{product.productName}</p>
                                        {product.description && (
                                            <p className="text-xs text-gray-600 mt-1">{product.description}</p>
                                        )}
                                        {product.contributedByTenant && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Added by: {product.contributedByTenant.name}
                                            </p>
                                        )}
                                    </div>
                                    {product.imageUrl && (
                                        <img
                                            src={product.imageUrl}
                                            alt={product.productName}
                                            className="w-12 h-12 object-cover rounded ml-3"
                                        />
                                    )}
                                </div>
                                {product.products && product.products.length > 0 && (
                                    <div className="mt-2 text-xs text-blue-600">
                                        💡 Stores using this: {product.products.length}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showResults && results.length === 0 && !loading && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
                    📋 No products found in catalog. Add this as a new product to contribute to the community database!
                </div>
            )}
        </div>
    )
}

export default GlobalCatalogSearch

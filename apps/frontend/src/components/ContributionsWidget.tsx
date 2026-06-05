import { useEffect, useState } from 'react'
import { useGlobalCatalogStats } from '@/hooks/useGlobalCatalog'

interface ContributionsWidgetProps {
    className?: string
}

/**
 * Widget showing this store's contributions to the global catalog
 * Helps store owners see their impact on the community
 */
export const ContributionsWidget = ({ className = '' }: ContributionsWidgetProps) => {
    const { getContributions, loading, error } = useGlobalCatalogStats()
    const [contributions, setContributions] = useState<any>(null)

    useEffect(() => {
        const loadContributions = async () => {
            const data = await getContributions()
            setContributions(data)
        }

        loadContributions()
    }, [getContributions])

    if (error) {
        return (
            <div className={`p-4 bg-red-50 border border-red-200 rounded ${className}`}>
                <p className="text-red-700 text-sm">Failed to load contributions</p>
            </div>
        )
    }

    if (loading || !contributions) {
        return (
            <div className={`p-4 ${className}`}>
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        )
    }

    const { contributions: productList = [], totalContributions = 0 } = contributions

    return (
        <div className={`bg-white border border-purple-200 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white ${className}`}>
            <h3 className="text-lg font-bold text-purple-800 mb-4">
                🏆 Your Community Contributions
            </h3>

            <div className="bg-white p-4 rounded border border-purple-200 mb-4">
                <div className="text-3xl font-bold text-purple-600">
                    {totalContributions}
                </div>
                <div className="text-sm text-purple-700 mt-1">
                    Product{totalContributions !== 1 ? 's' : ''} added to community database
                </div>
            </div>

            {productList && productList.length > 0 ? (
                <div>
                    <h4 className="text-sm font-semibold text-purple-700 mb-3">Your Contributions</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {productList.map((product: any) => (
                            <div
                                key={product.id}
                                className="p-3 bg-gradient-to-r from-purple-50 to-transparent border border-purple-100 rounded hover:border-purple-300 transition"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className="font-medium text-purple-900">{product.productName}</p>
                                        {product.description && (
                                            <p className="text-xs text-purple-700 mt-1">{product.description}</p>
                                        )}
                                        {product.products && product.products.length > 0 && (
                                            <p className="text-xs text-green-600 font-semibold mt-1">
                                                ✅ {product.products.length} store{product.products.length !== 1 ? 's' : ''} using this!
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
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded">
                    <p className="text-purple-700 text-sm">
                        You haven't contributed any products yet. Add a product to get started! 🚀
                    </p>
                </div>
            )}

            <div className="mt-4 p-3 bg-purple-100 border-l-4 border-purple-500 rounded">
                <p className="text-xs text-purple-800">
                    <strong>Impact:</strong> Your contributions help thousands of retailers save time while building a better database for Nigerian brands.
                </p>
            </div>
        </div>
    )
}

export default ContributionsWidget

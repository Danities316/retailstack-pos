import { useEffect, useState } from 'react'
import { useGlobalCatalogStats } from '@/hooks/useGlobalCatalog'

interface CatalogStatsWidgetProps {
    className?: string
    showRecentAdditions?: boolean
}

/**
 * Dashboard widget showing global catalog statistics
 * Displays catalog growth and community impact
 */
export const CatalogStatsWidget = ({
    className = '',
    showRecentAdditions = true
}: CatalogStatsWidgetProps) => {
    const { getStats, loading, error } = useGlobalCatalogStats()
    const [stats, setStats] = useState<any>(null)

    useEffect(() => {
        const loadStats = async () => {
            const data = await getStats()
            setStats(data)
        }

        loadStats()
    }, [getStats])

    if (error) {
        return (
            <div className={`p-4 bg-red-50 border border-red-200 rounded ${className}`}>
                <p className="text-red-700 text-sm">Failed to load catalog statistics</p>
            </div>
        )
    }

    if (loading || !stats) {
        return (
            <div className={`p-4 ${className}`}>
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        )
    }

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">
                🌍 Community Product Database
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">
                        {stats?.totalProducts || 0}
                    </div>
                    <div className="text-sm text-blue-700 mt-1">Products in Catalog</div>
                </div>

                <div className="bg-green-50 p-4 rounded border border-green-200">
                    <div className="text-2xl font-bold text-green-600">
                        {stats?.totalContributors || 0}
                    </div>
                    <div className="text-sm text-green-700 mt-1">Contributing Stores</div>
                </div>
            </div>

            {showRecentAdditions && stats?.recentAdditions && stats.recentAdditions.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">📌 Recently Added</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {stats.recentAdditions.slice(0, 5).map((product: any) => (
                            <div key={product.id} className="p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-800">
                                            {product.productName}
                                        </p>
                                        {product.contributedByTenant && (
                                            <p className="text-xs text-gray-600">
                                                by {product.contributedByTenant.name}
                                            </p>
                                        )}
                                    </div>
                                    {product.imageUrl && (
                                        <img
                                            src={product.imageUrl}
                                            alt={product.productName}
                                            className="w-8 h-8 object-cover rounded ml-2"
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                <p className="text-xs text-blue-700">
                    ✨ <strong>Every product you add</strong> helps other stores save time and build a better database for Nigerian retail!
                </p>
            </div>
        </div>
    )
}

export default CatalogStatsWidget

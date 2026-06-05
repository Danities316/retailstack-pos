import { useState, useEffect } from 'react'
import { useGlobalCatalogSearch } from '@/hooks/useGlobalCatalog'
import { Button } from '@/components/ui/button'

interface BarcodeGlobalLookupProps {
    barcode: string
    onProductFound?: (product: any) => void
    onProductNotFound?: () => void
    autoLookup?: boolean
    className?: string
}

/**
 * Component for looking up products by barcode in the global catalog
 * Useful for POS systems to check before manual entry
 */
export const BarcodeGlobalLookup = ({
    barcode,
    onProductFound,
    onProductNotFound,
    autoLookup = true,
    className = ''
}: BarcodeGlobalLookupProps) => {
    const [found, setFound] = useState<any>(null)
    const [notFound, setNotFound] = useState(false)
    const { searchByBarcode, loading } = useGlobalCatalogSearch()
    const [lookupDone, setLookupDone] = useState(false)

    useEffect(() => {
        if (!autoLookup || !barcode || barcode.length < 6) {
            return
        }

        const performLookup = async () => {
            const product = await searchByBarcode(barcode)

            if (product) {
                setFound(product)
                setNotFound(false)
                setLookupDone(true)
                if (onProductFound) {
                    onProductFound(product)
                }
            } else {
                setFound(null)
                setNotFound(true)
                setLookupDone(true)
                if (onProductNotFound) {
                    onProductNotFound()
                }
            }
        }

        performLookup()
    }, [barcode, autoLookup, searchByBarcode, onProductFound, onProductNotFound])

    if (!lookupDone && loading) {
        return (
            <div className={`p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm ${className}`}>
                🔍 Searching community database...
            </div>
        )
    }

    if (found) {
        return (
            <div className={`p-4 bg-green-50 border border-green-300 rounded ${className}`}>
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold text-green-900">✅ Found in Community Database!</h3>
                        <p className="text-green-800 mt-1">{found.productName}</p>
                        {found.description && (
                            <p className="text-sm text-green-700 mt-1">{found.description}</p>
                        )}
                        {found.contributedByTenant && (
                            <p className="text-xs text-green-600 mt-2">
                                Added by: {found.contributedByTenant.name}
                            </p>
                        )}
                        {found.products && found.products.length > 0 && (
                            <p className="text-xs text-green-600 mt-1">
                                {found.products.length} store{found.products.length !== 1 ? 's' : ''} using this
                            </p>
                        )}
                    </div>
                    {found.imageUrl && (
                        <img
                            src={found.imageUrl}
                            alt={found.productName}
                            className="w-16 h-16 object-cover rounded"
                        />
                    )}
                </div>
                <div className="mt-3 flex gap-2">
                    <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => onProductFound && onProductFound(found)}
                    >
                        Use This Product
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setFound(null); setLookupDone(false) }}>
                        Use Different
                    </Button>
                </div>
            </div>
        )
    }

    if (notFound) {
        return (
            <div className={`p-4 bg-yellow-50 border border-yellow-300 rounded ${className}`}>
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold text-yellow-900">📦 Not Yet in Catalog</h3>
                        <p className="text-yellow-800 mt-1">
                            This product hasn't been added to the community database yet.
                        </p>
                        <p className="text-sm text-yellow-700 mt-2">
                            You can add it as a new product, and it will automatically be synced to help other stores!
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

export default BarcodeGlobalLookup

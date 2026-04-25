import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Upload } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface Product {
  id: string
  productName: string
  productImage: string
  productColor: string
  productDescription: string
  costPrice: number
  sellingPrice: number
  quantity: number
  stock: number
  categoryId?: string
  category?: {
    categoryName: string
  }
}

export const ProductsPage = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [categories, setCategories] = useState<Array<{ id: string; categoryName: string }>>([])
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteFeedback, setDeleteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const baseURL = import.meta.env.VITE_API_BASE_URL
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Load products
        const productsData = await apiClient.getProducts()
        setProducts(productsData)

        // Load categories
        const categoriesResponse = await fetch(`${baseURL}/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json()
          setCategories(categoriesData)
        }
      } catch (error) {
        const isOffline = !navigator.onLine
        const errorMsg = isOffline
          ? 'You are offline. No cached products available. Go online to load products.'
          : 'Failed to load products'
        setError(errorMsg)
        console.error('Error loading products:', error)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadData()
    }
  }, [token])

  const handleDeleteClick = (product: Product) => {
    setDeleteTarget(product)
    setDeleteFeedback(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteFeedback(null)

    try {
      // Use direct fetch because DELETE returns 204 No Content,
      // which breaks apiClient.request's JSON parsing.
      const response = await fetch(`${baseURL}/products/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Failed to delete product (HTTP ${response.status})`)
      }

      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
      setDeleteFeedback({ type: 'success', message: 'Product deleted successfully.' })
    } catch (error: any) {
      console.error('Failed to delete product:', error)
      setDeleteFeedback({
        type: 'error',
        message:
          typeof error?.message === 'string'
            ? error.message
            : 'Failed to delete product. Please try again.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    setDeleteTarget(null)
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productDescription.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !filterCategory || product.categoryId === filterCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading products...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900">Product Catalog</h1>

          {/* --- ADD NEW BUTTONS FOR MANAGEMENT ACTIONS --- */}
          <div className="flex gap-3">
            {(user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER') && (
              <>
                {/* Button to navigate to the Import page */}
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard/products/import')}
                  className="bg-green-100 hover:bg-green-200 text-green-700"
                >
                  <Upload className="w-4 h-4 mr-2" /> Bulk Import
                </Button>

                {/* Existing 'Add New Product' Button */}
                <Button onClick={() => navigate('/dashboard/products/new')}>
                  <Plus className="w-4 h-4 mr-2" /> Add New
                </Button>
              </>
            )}
          </div>
        </div>
      </div>


      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.categoryName}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">

            {product.productImage && (
              <img
                src={product.productImage}
                alt={product.productName}
                className="w-full h-32 object-cover rounded mb-3"
              />
            )}

            <h3 className="font-semibold text-lg mb-2">{product.productName}</h3>

            {product.productDescription && (
              <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                {product.productDescription}
              </p>
            )}

            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Price:</span> ${product.sellingPrice}</p>
              <p><span className="font-medium">Cost:</span> ${product.costPrice}</p>
              <p><span className="font-medium">Stock:</span> {product.stock}</p>
              {product.category && (
                <p><span className="font-medium">Category:</span> {product.category.categoryName}</p>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER') && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/dashboard/products/${product.id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleDeleteClick(product)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No products found</p>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
              Delete product
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteTarget.productName}</span>? This action
              will remove it from the catalog for this store.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inline delete feedback toast */}
      {deleteFeedback && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg text-sm text-white ${deleteFeedback.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
        >
          {deleteFeedback.message}
        </div>
      )}
    </div>
  )
}
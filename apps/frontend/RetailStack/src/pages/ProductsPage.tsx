import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  isOffline?: boolean
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
        setError('Failed to load products')
        console.error('Error loading products:', error)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadData()
    }
  }, [token])

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      await apiClient.request(`/products/${productId}`, { method: 'DELETE' })
      setProducts(products.filter(p => p.id !== productId))
    } catch (error) {
      console.error('Failed to delete product:', error)
    }
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl text-blue-600 font-semibold">Products</h1>
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER') && (
          <Link to="/dashboard/products/create">
            <Button  className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150">Create Product</Button>
          </Link>
        )}
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
            {product.isOffline && (
              <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mb-2">
                Offline
              </div>
            )}
            
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
                    onClick={() => handleDelete(product.id)}
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
    </div>
  )
}
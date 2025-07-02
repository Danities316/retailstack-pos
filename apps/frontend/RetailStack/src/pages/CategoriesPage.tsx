import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface Category {
  id: string
  categoryName: string
  parentId?: string
  children?: Category[]
  createdAt: string
  updatedAt: string
}

export const CategoriesPage = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(true)
        const categoriesData = await apiClient.request('/categories')
        setCategories(categoriesData)
      } catch (error) {
        setError('Failed to load categories')
        console.error('Error loading categories:', error)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadCategories()
    }
  }, [token])

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) return

    try {
      await apiClient.request(`/categories/${categoryId}`, { method: 'DELETE' })
      // Reload categories after deletion
      const updatedCategories = await apiClient.request('/categories')
      setCategories(updatedCategories)
    } catch (error: any) {
      console.error('Failed to delete category:', error)
      alert(error.message || 'Failed to delete category. Make sure it has no products or sub-categories.')
    }
  }

  const renderCategoryTree = (categoryList: Category[], level: number = 0): JSX.Element[] => {
    return categoryList.map(category => (
      <div key={category.id} className="border-l-2 border-gray-200 pl-4 ml-4">
        <div className="flex items-center justify-between py-3 hover:bg-gray-50 rounded-lg px-3">
          <div className="flex items-center space-x-3">
            <div 
              className="w-4 h-4 rounded-full bg-blue-500"
              style={{ marginLeft: `${level * 20}px` }}
            ></div>
            <div>
              <h3 className="font-medium text-gray-900">{category.categoryName}</h3>
              <p className="text-sm text-gray-500">
                {category.children && category.children.length > 0 
                  ? `${category.children.length} sub-categories`
                  : 'No sub-categories'
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/dashboard/categories/${category.id}/edit`)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600"
              onClick={() => handleDelete(category.id)}
            >
              Delete
            </Button>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div className="mt-2">
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading categories...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-blue-600 font-semibold">Categories</h1>
          <p className="text-gray-600">Manage your product categories</p>
        </div>
        <Link to="/dashboard/categories/create">
          <Button className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150">Create Category</Button>
        </Link>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Categories Tree */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Category Structure</h2>
          
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No categories found</p>
              <Link to="/dashboard/categories/create">
                <Button>Create Your First Category</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {renderCategoryTree(categories)}
            </div>
          )}
        </div>
      </div>

      {/* Category Statistics */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Category Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Categories</p>
            <p className="text-2xl font-bold">{categories.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Top Level Categories</p>
            <p className="text-2xl font-bold">
              {categories.filter(cat => !cat.parentId).length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Sub Categories</p>
            <p className="text-2xl font-bold">
              {categories.filter(cat => cat.parentId).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 
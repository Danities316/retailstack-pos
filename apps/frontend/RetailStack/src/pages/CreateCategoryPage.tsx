import { useState, useEffect } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface Category {
  id: string
  categoryName: string
  parentId?: string
  children?: Category[]
}

export const CreateCategoryPage = () => {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [categoryName, setCategoryName] = useState('')
  const [parentId, setParentId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Load existing categories for parent selection
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await apiClient.request('/categories')
        setCategories(categoriesData)
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }

    if (token) {
      loadCategories()
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!categoryName.trim()) {
      setError('Category name is required')
      setLoading(false)
      return
    }

    try {
      const categoryData = {
        categoryName: categoryName.trim(),
        parentId: parentId || undefined
      }

      await apiClient.request('/categories', {
        method: 'POST',
        body: JSON.stringify(categoryData)
      })

      setSuccess('Category created successfully!')
      setTimeout(() => navigate('/dashboard/categories'), 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to create category')
    } finally {
      setLoading(false)
    }
  }

  const renderCategoryOptions = (categoryList: Category[], level: number = 0): React.ReactElement[] => {
    return categoryList.map(category => (
      <option key={category.id} value={category.id}>
        {'—'.repeat(level)} {category.categoryName}
      </option>
    ))
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-blue-600 font-semibold">Create Category</h1>
          <p className="text-gray-600">Add a new product category</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard/categories')}>
          Back to Categories
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <div>
            <label htmlFor="categoryName" className="block text-sm font-medium text-gray-700 mb-2">
              Category Name *
            </label>
            <Input
              id="categoryName"
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Enter category name"
              required
            />
          </div>

          <div>
            <label htmlFor="parentCategory" className="block text-sm font-medium text-gray-700 mb-2">
              Parent Category (Optional)
            </label>
            <select
              id="parentCategory"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No parent (Top level category)</option>
              {renderCategoryOptions(categories)}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Leave empty to create a top-level category, or select a parent to create a sub-category
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading || !categoryName.trim()} className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150">
              {loading ? 'Creating...' : 'Create Category'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/dashboard/categories')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {/* Help Section */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Category Guidelines</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Use descriptive names that clearly identify the category</li>
          <li>• Create a logical hierarchy with parent and sub-categories</li>
          <li>• Categories can be nested to organize products effectively</li>
          <li>• You can edit or delete categories later from the main categories page</li>
        </ul>
      </div>
    </div>
  )
} 
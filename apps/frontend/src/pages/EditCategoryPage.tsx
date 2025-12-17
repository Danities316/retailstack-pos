import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

export const EditCategoryPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [categoryName, setCategoryName] = useState('')
  const [parentId, setParentId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Load category data and available categories
  useEffect(() => {
    const loadData = async () => {
      if (!id || !token) return

      try {
        setLoading(true)
        
        // Load the category to edit
        const categoryData = await apiClient.request(`/categories/${id}`)
        setCategoryName(categoryData.categoryName)
        setParentId(categoryData.parentId || '')

        // Load all categories for parent selection
        const allCategories = await apiClient.request('/categories')
        // Filter out the current category and its children to prevent circular references
        const filteredCategories = filterCategoriesForParent(allCategories, id)
        setCategories(filteredCategories)
      } catch (error) {
        setError('Failed to load category data')
        console.error('Error loading category:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, token])

  const filterCategoriesForParent = (categoryList: Category[], currentId: string): Category[] => {
    const result: Category[] = []
    
    const addCategoryIfValid = (category: Category) => {
      if (category.id !== currentId && !isDescendant(category, currentId, categoryList)) {
        result.push(category)
        if (category.children) {
          category.children.forEach(addCategoryIfValid)
        }
      }
    }

    categoryList.forEach(addCategoryIfValid)
    return result
  }

  const isDescendant = (category: Category, targetId: string, allCategories: Category[]): boolean => {
    if (category.children) {
      for (const child of category.children) {
        if (child.id === targetId || isDescendant(child, targetId, allCategories)) {
          return true
        }
      }
    }
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    if (!categoryName.trim()) {
      setError('Category name is required')
      setSaving(false)
      return
    }

    try {
      const categoryData = {
        categoryName: categoryName.trim(),
        parentId: parentId || undefined
      }

      await apiClient.request(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(categoryData)
      })

      setSuccess('Category updated successfully!')
      setTimeout(() => navigate('/dashboard/categories'), 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  const renderCategoryOptions = (categoryList: Category[], level: number = 0): JSX.Element[] => {
    return categoryList.map(category => (
      <option key={category.id} value={category.id}>
        {'—'.repeat(level)} {category.categoryName}
      </option>
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading category...</p>
      </div>
    )
  }

  if (error && !categoryName) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => navigate('/dashboard/categories')}>
            Back to Categories
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-blue-600 font-semibold">Edit Category</h1>
          <p className="text-gray-600">Update category information</p>
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
              Parent Category
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
              Select a parent category or leave empty for top-level
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={saving || !categoryName.trim()}className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150">
              {saving ? 'Saving...' : 'Save Changes'}
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

      {/* Warning Section */}
      <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-yellow-800">Important Notes</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Changes to category structure may affect product organization</li>
          <li>• Sub-categories will move with their parent category</li>
          <li>• You cannot set a category as its own parent or child</li>
        </ul>
      </div>
    </div>
  )
} 
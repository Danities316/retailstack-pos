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

  // Theme colors
  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#3B82F6'
  const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#64748B'
  const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#F8FAFC'
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#E2E8F0'
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--color-error').trim() || '#EF4444'

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
      <div key={category.id} style={{ borderLeft: `2px solid #0f172a`, paddingLeft: 16, marginLeft: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: 8, transition: 'background 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = surfaceColor + '60'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <div className="flex items-center space-x-3">
            <div
              style={{ width: 16, height: 16, borderRadius: '50%', background: '#D4AF37', marginLeft: `${level * 20}px` }}
            ></div>
            <div>
              <h3 style={{ fontWeight: 500, color: '#D4AF37', margin: 0 }}>{category.categoryName}</h3>
              <p style={{ fontSize: 12, color: '#0f172a', margin: '4px 0 0 0' }}>
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
              style={{ color: '#D4AF37', borderColor: '#0f172a', background: 'transparent', fontSize: 12, padding: '6px 12px', borderRadius: 6 }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDelete(category.id)}
              style={{ color: errorColor, borderColor: errorColor, background: 'transparent', fontSize: 12, padding: '6px 12px', borderRadius: 6 }}
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
        <p style={{ color: secondaryColor }}>Loading categories...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1152px', margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Categories</h1>
          <p style={{ color: secondaryColor, marginTop: 4 }}>Manage your product categories</p>
        </div>
        <Link to="/dashboard/categories/create">
          <Button style={{ background: '#0f172a', borderColor: '#0f172a', color: '#D4AF37' }}>+ Create Category</Button>
        </Link>
      </div>

      {error && (
        <p style={{ color: errorColor, fontSize: 14, marginBottom: 16, padding: 12, background: '#FEE2E2', borderRadius: 8, borderLeft: `4px solid ${errorColor}` }}>
          {error}
        </p>
      )}

      {/* Categories Tree */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', marginBottom: 24 }}>
        <div style={{ padding: 24, borderBottom: `1px solid ${borderColor}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#0f172a' }}>Category Structure</h2>

          {categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: secondaryColor, marginBottom: 16 }}>No categories found</p>
              <Link to="/dashboard/categories/create">
                <Button style={{ background: primaryColor, color: '#fff', padding: '10px 24px', borderRadius: 8 }}>Create Your First Category</Button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {renderCategoryTree(categories)}
            </div>
          )}
        </div>
      </div>

      {/* Category Statistics */}
      <div style={{ background: surfaceColor, padding: 16, borderRadius: 12, border: `1px solid ${borderColor}` }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#1E293B' }}>Category Statistics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Total Categories</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#D4AF37' }}>{categories.length}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Top Level Categories</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#D4AF37' }}>
              {categories.filter(cat => !cat.parentId).length}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Sub Categories</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#D4AF37' }}>
              {categories.filter(cat => cat.parentId).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 
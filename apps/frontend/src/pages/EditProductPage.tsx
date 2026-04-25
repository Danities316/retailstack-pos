import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface Category {
  id: string
  categoryName: string
}

export const EditProductPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, token } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    productName: '',
    productImage: '',
    productColor: '',
    productDescription: '',
    costPrice: '',
    sellingPrice: '',
    quantity: '',
    stock: '',
    categoryId: '',
  })

  // Authorization guard
  useEffect(() => {
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'OWNER' && user.role !== 'MANAGER')) {
      navigate('/dashboard')
      return
    }
  }, [user, navigate])

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      if (!token) return
      setCategoriesLoading(true)
      try {
        const categoriesData = await apiClient.getCategories()
        setCategories(categoriesData)
      } catch (e) {
        console.error('Failed to load categories:', e)
      } finally {
        setCategoriesLoading(false)
      }
    }

    loadCategories()
  }, [token])

  // Load product to edit
  useEffect(() => {
    const loadProduct = async () => {
      if (!id || !token) return
      try {
        setLoading(true)
        setError(null)
        const product = await apiClient.request(`/products/${id}`)
        setForm({
          productName: product.productName ?? '',
          productImage: product.productImage ?? '',
          productColor: product.productColor ?? '',
          productDescription: product.productDescription ?? '',
          costPrice: String(product.costPrice ?? ''),
          sellingPrice: String(product.sellingPrice ?? ''),
          quantity: String(product.quantity ?? ''),
          stock: String(product.stock ?? ''),
          categoryId: product.categoryId ?? '',
        })
      } catch (e: any) {
        console.error('Failed to load product:', e)
        setError(e?.message || 'Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [id, token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const productData = {
        ...form,
        costPrice: parseFloat(form.costPrice),
        sellingPrice: parseFloat(form.sellingPrice),
        quantity: parseInt(form.quantity) || 0,
        stock: parseInt(form.stock) || 0,
        categoryId: form.categoryId || null,
        updatedAt: new Date().toISOString(),
      }

      await apiClient.request(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData),
      })

      setSuccess('Product updated successfully!')
      setTimeout(() => navigate('/dashboard/products'), 1200)
    } catch (err: any) {
      setError(err?.message || 'Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading product...</p>
      </div>
    )
  }

  if (error && !form.productName) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => navigate('/dashboard/products')}>Back to Products</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow border p-8">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">Edit Product</h1>
        <p className="text-gray-800 mb-6">Update the details below to edit this product.</p>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-5 text-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              name="productName"
              placeholder="Product Name *"
              value={form.productName}
              onChange={handleChange}
              required
              className="text-gray-800"
            />
            <Input
              name="productImage"
              placeholder="Product Image URL"
              value={form.productImage}
              onChange={handleChange}
              className="text-gray-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              name="productColor"
              placeholder="Product Color"
              value={form.productColor}
              onChange={handleChange}
              className="text-gray-800"
            />
            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              className="border rounded-md px-3 py-2 w-full text-gray-800"
              disabled={categoriesLoading}
            >
              <option value="">
                {categoriesLoading ? 'Loading categories...' : 'Select Category (Optional)'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </div>

          <Input
            name="productDescription"
            placeholder="Product Description"
            value={form.productDescription}
            onChange={handleChange}
            className="text-gray-800"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              name="costPrice"
              type="number"
              step="0.01"
              placeholder="Cost Price *"
              value={form.costPrice}
              onChange={handleChange}
              required
              className="text-gray-800"
            />
            <Input
              name="sellingPrice"
              type="number"
              step="0.01"
              placeholder="Selling Price *"
              value={form.sellingPrice}
              onChange={handleChange}
              required
              className="text-gray-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              name="quantity"
              type="number"
              placeholder="Quantity"
              value={form.quantity}
              onChange={handleChange}
              className="text-gray-800"
            />
            <Input
              name="stock"
              type="number"
              placeholder="Stock"
              value={form.stock}
              onChange={handleChange}
              className="text-gray-800"
            />
          </div>

          <div className="flex gap-4 justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/products')}
              className="bg-gray-400 hover:bg-gray-800 hover:text-white text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}


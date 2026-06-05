import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'
import { compressImage } from '@/lib/compressImage'

interface Category {
  id: string
  categoryName: string
}

const COLOR_RELEVANT_CATEGORIES = [
  'clothing', 'clothes', 'fashion', 'apparel', 'fabric',
  'footwear', 'shoes', 'bags', 'accessories', 'ankara',
  'shoe', 'wear', 'dress', 'shirt', 'trouser',
]

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
    stock: '',
    categoryId: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')

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
        const legacyStock = Math.max(
          Number(product.stock ?? 0),
          Number(product.quantity ?? 0)
        )
        setForm({
          productName: product.productName ?? '',
          productImage: product.productImage ?? '',
          productColor: product.productColor ?? '',
          productDescription: product.productDescription ?? '',
          costPrice: String(product.costPrice ?? ''),
          sellingPrice: String(product.sellingPrice ?? ''),
          stock: String(legacyStock),
          categoryId: product.categoryId ?? '',
        })
        setImagePreview(product.productImage ?? '')
      } catch (e: any) {
        console.error('Failed to load product:', e)
        setError(e?.message || 'Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [id, token])

  const selectedCategoryName = categories
    .find(c => c.id === form.categoryId)
    ?.categoryName?.toLowerCase() ?? ''

  const showColorField = COLOR_RELEVANT_CATEGORIES.some(keyword =>
    selectedCategoryName.includes(keyword)
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // ── Client-side validation ──────────────────────────────────────────────
    const parsedCost = parseFloat(form.costPrice)
    const parsedSelling = parseFloat(form.sellingPrice)
    const parsedStock = parseInt(form.stock)

    if (!form.productName?.trim()) {
      setError('Product name is required.')
      return
    }
    if (isNaN(parsedSelling) || parsedSelling <= 0) {
      setError('Selling price must be greater than zero.')
      return
    }
    if (isNaN(parsedCost) || parsedCost < 0) {
      setError('Cost price cannot be negative.')
      return
    }
    if (parsedCost > parsedSelling) {
      setError('Cost price cannot be greater than selling price. You would be selling at a loss.')
      return
    }
    if (isNaN(parsedStock) || parsedStock < 0) {
      setError('Stock quantity cannot be negative.')
      return
    }
    // ── End validation ──────────────────────────────────────────────────────

    if (!id) return

    setLoading(true)

    try {
      const productData = {
        ...form,
        productColor: showColorField ? form.productColor : '',
        costPrice: parsedCost,
        sellingPrice: parsedSelling,
        quantity: parsedStock,
        stock: parsedStock,
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
      setLoading(false)
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
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Product Name *
              </label>
              <Input
                name="productName"
                placeholder="e.g. Indomie Chicken 70g"
                value={form.productName}
                onChange={handleChange}
                required
                className="text-gray-800"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#6b7280' }}>
                Product Photo (optional)
              </label>

              {imagePreview && (
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(''); setForm(f => ({ ...f, productImage: '' })) }}
                    style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <label
                htmlFor="product-image-input"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', border: '1.5px dashed #d1d5db', borderRadius: 8, fontSize: 13, color: '#6b7280', background: '#f9fafb' }}
              >
                📷 {imagePreview ? 'Change photo' : 'Add photo'}
              </label>
              <input
                id="product-image-input"
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImageFile(file)

                  try {
                    const compressed = await compressImage(file)
                    setImagePreview(compressed)
                    setForm(f => ({ ...f, productImage: compressed }))
                  } catch {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      const result = reader.result as string
                      setImagePreview(result)
                      setForm(f => ({ ...f, productImage: result }))
                    }
                    reader.readAsDataURL(file)
                  }
                }}
              // onChange={(e) => {
              //   const file = e.target.files?.[0]
              //   if (!file) return
              //   setImageFile(file)
              //   const reader = new FileReader()
              //   reader.onloadend = () => {
              //     const result = reader.result as string
              //     setImagePreview(result)
              //     setForm(f => ({ ...f, productImage: result }))
              //   }
              //   reader.readAsDataURL(file)
              // }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {showColorField && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Product Color
                </label>
                <Input
                  name="productColor"
                  placeholder="e.g. Red, Blue, Black"
                  value={form.productColor}
                  onChange={handleChange}
                  className="text-gray-800"
                />
              </div>
            )}
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

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Product Description
            </label>
            <Input
              name="productDescription"
              placeholder="e.g. Instant noodles, chicken flavour, single pack"
              value={form.productDescription}
              onChange={handleChange}
              className="text-gray-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cost Price *
              </label>
              <Input
                name="costPrice"
                type="number"
                step="1"
                aria-label="Buying Price (what YOU paid) *"
                placeholder="e.g. 150"
                value={form.costPrice}
                onChange={handleChange}
                required
                className="text-gray-800"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Selling Price *
              </label>
              <Input
                name="sellingPrice"
                type="number"
                step="1"
                aria-label="Selling Price (what customers pay) *"
                placeholder="e.g. 200"
                value={form.sellingPrice}
                onChange={handleChange}
                required
                className="text-gray-800"
              />
            </div>
          </div>
          {form.costPrice && form.sellingPrice &&
            parseFloat(form.sellingPrice) > parseFloat(form.costPrice) && (
              <p style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                ✓ You will make ₦{(parseFloat(form.sellingPrice) - parseFloat(form.costPrice)).toLocaleString('en-NG')} profit per unit
                ({Math.round(((parseFloat(form.sellingPrice) - parseFloat(form.costPrice)) / parseFloat(form.sellingPrice)) * 100)}% margin)
              </p>
            )}
          {form.costPrice && form.sellingPrice &&
            parseFloat(form.sellingPrice) <= parseFloat(form.costPrice) && (
              <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                ⚠ Selling price is lower than or equal to buying price — you will not make a profit
              </p>
            )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                How many do you have right now?
              </label>
              <Input
                name="stock"
                type="number"
                placeholder="How many do you have right now?"
                value={form.stock}
                onChange={handleChange}
                className="text-gray-800"
              />
            </div>
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


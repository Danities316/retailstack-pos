import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'
import { GlobalCatalogSearch } from '@/components/GlobalCatalogSearch'
import { BarcodeGlobalLookup } from '@/components/BarcodeGlobalLookup'
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

const label = (text: string, required = false) => (
  <label style={{
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#6b7280', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: '0.04em'
  }}>
    {text}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
  </label>
)

export const CreateProductPage = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [catalogHint, setCatalogHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    productName: '',
    sellingPrice: '',
    costPrice: '',
    stock: '',
    // Advanced fields
    barcode: '',
    sku: '',
    categoryId: '',
    productDescription: '',
    productColor: '',
    productImage: '',
    contributeToGlobalCatalog: true,
  })

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(user.role)) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  // ── Load categories ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    setCategoriesLoading(true)
    apiClient.getCategories()
      .then(setCategories)
      .catch(() => setError('Failed to load categories.'))
      .finally(() => setCategoriesLoading(false))
  }, [token])

  const selectedCategoryName = categories
    .find(c => c.id === form.categoryId)?.categoryName?.toLowerCase() ?? ''

  const showColorField = COLOR_RELEVANT_CATEGORIES.some(k =>
    selectedCategoryName.includes(k)
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleProductFound = useCallback((product: any) => {
    setForm(f => ({
      ...f,
      barcode: product.barcode || f.barcode,
      productName: product.productName || f.productName,
      productDescription: product.description || f.productDescription,
      productImage: product.imageUrl || f.productImage,
    }))
    if (product.imageUrl) setImagePreview(product.imageUrl)
    setCatalogHint('Details prefilled from the community catalog. You can still edit them.')
  }, [])

  const handleProductNotFound = useCallback(() => {
    setCatalogHint('Not in the catalog yet — your product will be added when you save.')
  }, [])

  // ── Validation and submit ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const parsedSelling = parseFloat(form.sellingPrice)
    const parsedCost = parseFloat(form.costPrice) || 0
    const parsedStock = parseInt(form.stock) || 0

    if (!form.productName.trim()) {
      setError('Product name is required.')
      return
    }
    if (isNaN(parsedSelling) || parsedSelling <= 0) {
      setError('Selling price must be greater than zero.')
      return
    }
    if (parsedCost < 0) {
      setError('Cost price cannot be negative.')
      return
    }
    if (parsedCost > parsedSelling) {
      setError('Cost price cannot be greater than selling price. You would be selling at a loss.')
      return
    }
    if (parsedStock < 0) {
      setError('Stock quantity cannot be negative.')
      return
    }

    setLoading(true)
    try {
      const productData = {
        productName: form.productName,
        sellingPrice: parsedSelling,
        costPrice: parsedCost,
        quantity: parsedStock,
        barcode: form.barcode || undefined,
        sku: form.sku || undefined,
        categoryId: form.categoryId || null,
        productDescription: form.productDescription || undefined,
        productColor: showColorField ? form.productColor : '',
        productImage: form.productImage || '',
        contributeToGlobalCatalog: !!form.contributeToGlobalCatalog,
      }

      const response = await apiClient.createProductWithGlobalSync(productData)
      setSuccess(response.message || 'Product created successfully!')
      setTimeout(() => navigate('/dashboard/products'), 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to create product.')
    } finally {
      setLoading(false)
    }
  }

  if (!user || !['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(user.role)) {
    return <div>Access denied</div>
  }

  const hasProfit = form.sellingPrice && form.costPrice &&
    parseFloat(form.sellingPrice) > parseFloat(form.costPrice)
  const hasLoss = form.sellingPrice && form.costPrice &&
    parseFloat(form.sellingPrice) <= parseFloat(form.costPrice)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow border p-8">

        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Add Product</h1>
        <p className="text-gray-500 text-sm mb-6">Fill in the 4 required fields to get started quickly.</p>

        {error && <p className="text-red-500   text-sm mb-4 p-3 bg-red-50   rounded-lg">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 p-3 bg-green-50 rounded-lg">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── CORE 4 FIELDS ── */}
          <div>
            {label('Product Name', true)}
            <Input
              name="productName"
              placeholder="e.g. Indomie Chicken 70g"
              value={form.productName}
              onChange={handleChange}
              autoFocus
              className="text-gray-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {label('Selling Price (₦)', true)}
              <Input
                name="sellingPrice"
                type="number"
                step="1"
                min="0"
                placeholder="e.g. 200"
                value={form.sellingPrice}
                onChange={handleChange}
                className="text-gray-800"
              />
            </div>
            <div>
              {label('Buying Price / Cost Price (₦)', true)}
              <Input
                name="costPrice"
                type="number"
                step="1"
                min="0"
                placeholder="e.g. 200"
                value={form.costPrice}
                onChange={handleChange}
                className="text-gray-800"
              />
            </div>
            <div>
              {label('How many in stock?', true)}
              <Input
                name="stock"
                type="number"
                step="1"
                min="0"
                placeholder="e.g. 50"
                value={form.stock}
                onChange={handleChange}
                className="text-gray-800"
              />
            </div>
          </div>

          {/* ── PROFIT HINT ── */}
          {hasProfit && (
            <p style={{ fontSize: 12, color: '#16a34a' }}>
              ✓ You will make ₦{(parseFloat(form.sellingPrice) - parseFloat(form.costPrice)).toLocaleString('en-NG')} profit per unit
              ({Math.round(((parseFloat(form.sellingPrice) - parseFloat(form.costPrice)) / parseFloat(form.sellingPrice)) * 100)}% margin)
            </p>
          )}
          {hasLoss && (
            <p style={{ fontSize: 12, color: '#ef4444' }}>
              ⚠ Selling price is lower than or equal to buying price — you will not make a profit
            </p>
          )}

          {/* ── ADVANCED TOGGLE ── */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: '50%',
                border: '1.5px solid currentColor', fontSize: 11, lineHeight: 1,
              }}>
                {showAdvanced ? '−' : '+'}
              </span>
              {showAdvanced ? 'Hide advanced options' : 'Add more details (barcode, cost price, photo…)'}
            </button>
          </div>

          {/* ── ADVANCED FIELDS ── */}
          {showAdvanced && (
            <div className="space-y-5 pt-2 border-t border-gray-100">

              {/* Cost price */}
              {/* <div>
                {label('Buying Price / Cost Price (₦)')}
                <Input
                  name="costPrice"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 150 — what YOU paid for it"
                  value={form.costPrice}
                  onChange={handleChange}
                  className="text-gray-800"
                />
              </div> */}

              {/* Barcode + Community Catalog lookup */}
              <div>
                {label('Barcode')}
                <Input
                  name="barcode"
                  placeholder="Scan or type barcode (optional)"
                  value={form.barcode}
                  onChange={handleChange}
                  className="text-gray-800"
                />
                {form.barcode && (
                  <BarcodeGlobalLookup
                    barcode={form.barcode}
                    onProductFound={handleProductFound}
                    onProductNotFound={handleProductNotFound}
                    autoLookup
                    className="mt-2"
                  />
                )}
              </div>

              {/* Community Catalog name search */}
              <div>
                {label('Search Community Catalog')}
                <p className="text-xs text-gray-500 mb-2">
                  Find this product in the shared Nigerian product database to prefill details automatically.
                </p>
                <GlobalCatalogSearch
                  onProductFound={handleProductFound}
                  onProductNotFound={handleProductNotFound}
                />
                {catalogHint && (
                  <p className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">{catalogHint}</p>
                )}
              </div>

              {/* SKU */}
              <div>
                {label('SKU')}
                <Input
                  name="sku"
                  placeholder="e.g. INDM-70G-CHICK (optional)"
                  value={form.sku}
                  onChange={handleChange}
                  className="text-gray-800"
                />
              </div>

              {/* Category */}
              <div>
                {label('Category')}
                <select
                  name="categoryId"
                  value={form.categoryId}
                  onChange={handleChange}
                  className="border rounded-md px-3 py-2 w-full text-gray-800"
                  disabled={categoriesLoading}
                >
                  <option value="">
                    {categoriesLoading ? 'Loading...' : 'Select category (optional)'}
                  </option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.categoryName}</option>
                  ))}
                </select>
              </div>

              {/* Color — only for clothing categories */}
              {showColorField && (
                <div>
                  {label('Product Color')}
                  <Input
                    name="productColor"
                    placeholder="e.g. Red, Blue, Black"
                    value={form.productColor}
                    onChange={handleChange}
                    className="text-gray-800"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                {label('Description')}
                <Input
                  name="productDescription"
                  placeholder="e.g. Instant noodles, chicken flavour, single pack"
                  value={form.productDescription}
                  onChange={handleChange}
                  className="text-gray-800"
                />
              </div>

              {/* Photo */}
              <div>
                {label('Product Photo')}
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
                    >✕</button>
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
                />
              </div>

              {/* Community Catalog opt-in */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="contributeToGlobalCatalog"
                  checked={!!form.contributeToGlobalCatalog}
                  onChange={handleChange}
                  className="mt-0.5 w-4 h-4"
                />
                <span className="text-sm text-gray-600">
                  Add this product to the Adino community catalog so other Nigerian shops can find it faster.
                  <span className="block text-xs text-gray-400 mt-0.5">
                    Only the product name, barcode, and photo are shared. Your prices are never shared.
                  </span>
                </span>
              </label>

            </div>
          )}

          {/* ── ACTION BUTTONS ── */}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/products')}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6"
            >
              {loading ? 'Saving...' : 'Save Product'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  )
}


// import { useState, useEffect, useCallback } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { Input } from '@/components/ui/input'
// import { Button } from '@/components/ui/button'
// import { useAuth } from '@/context/AuthContext'
// import { apiClient } from '@/lib/apiClient'
// import { GlobalCatalogSearch } from '@/components/GlobalCatalogSearch'
// import { BarcodeGlobalLookup } from '@/components/BarcodeGlobalLookup'
// import { compressImage } from '@/lib/compressImage'


// interface Category {
//   id: string
//   categoryName: string
// }

// const COLOR_RELEVANT_CATEGORIES = [
//   'clothing', 'clothes', 'fashion', 'apparel', 'fabric',
//   'footwear', 'shoes', 'bags', 'accessories', 'ankara',
//   'shoe', 'wear', 'dress', 'shirt', 'trouser',
// ]

// export const CreateProductPage = () => {
//   const navigate = useNavigate()
//   const { user, token } = useAuth()
//   const [categories, setCategories] = useState<Category[]>([])
//   const [categoriesLoading, setCategoriesLoading] = useState(false)
//   const [form, setForm] = useState({
//     barcode: '',
//     productName: '',
//     productImage: '',
//     sku: '',
//     productColor: '',
//     productDescription: '',
//     costPrice: '',
//     sellingPrice: '',
//     stock: '',
//     categoryId: ''
//   })
//   const [imageFile, setImageFile] = useState<File | null>(null)
//   const [imagePreview, setImagePreview] = useState<string>('')
//   const [catalogHint, setCatalogHint] = useState<string | null>(null)
//   const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<any>(null)
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [success, setSuccess] = useState<string | null>(null)
//   // Check authorization
//   useEffect(() => {
//     if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'OWNER' && user.role !== 'MANAGER')) {
//       navigate('/dashboard')
//       return
//     }
//   }, [user, navigate])

//   // Load categories
//   useEffect(() => {
//     const loadCategories = async () => {
//       setCategoriesLoading(true)
//       try {
//         const categoriesData = await apiClient.getCategories()
//         setCategories(categoriesData)
//       } catch (error) {
//         console.error('Failed to load categories:', error)
//         setError('Failed to load categories. Please try again.')
//       } finally {
//         setCategoriesLoading(false)
//       }
//     }

//     if (token) {
//       loadCategories()
//     }
//   }, [token])

//   const selectedCategoryName = categories
//     .find(c => c.id === form.categoryId)
//     ?.categoryName?.toLowerCase() ?? ''

//   const showColorField = COLOR_RELEVANT_CATEGORIES.some(keyword =>
//     selectedCategoryName.includes(keyword)
//   )

//   const handleProductFound = useCallback((product: any) => {
//     setSelectedCatalogProduct(product)
//     setForm((current) => ({
//       ...current,
//       barcode: product.barcode || current.barcode,
//       productName: product.productName || current.productName,
//       productDescription: product.description || current.productDescription,
//       productImage: product.imageUrl || current.productImage,
//     }))
//     setImagePreview(product.imageUrl || current.imagePreview)
//     setCatalogHint('This product exists in the shared catalog. Its details have been prefilled for you.')
//   }, [])

//   const handleProductNotFound = useCallback(() => {
//     setSelectedCatalogProduct(null)
//     setCatalogHint('No matching community catalog product was found. Add it now to contribute to the shared Nigerian database.')
//   }, [])

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     setForm({ ...form, [e.target.name]: e.target.value })
//   }

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setError(null)
//     setSuccess(null)

//     // ── Client-side validation ──────────────────────────────────────────────
//     const parsedCost = parseFloat(form.costPrice)
//     const parsedSelling = parseFloat(form.sellingPrice)
//     const parsedStock = parseInt(form.stock)

//     if (!form.productName.trim()) {
//       setError('Product name is required.')
//       return
//     }
//     if (isNaN(parsedSelling) || parsedSelling <= 0) {
//       setError('Selling price must be greater than zero.')
//       return
//     }
//     if (isNaN(parsedCost) || parsedCost < 0) {
//       setError('Cost price cannot be negative.')
//       return
//     }
//     if (parsedCost > parsedSelling) {
//       setError('Cost price cannot be greater than selling price. You would be selling at a loss.')
//       return
//     }
//     if (isNaN(parsedStock) || parsedStock < 0) {
//       setError('Stock quantity cannot be negative.')
//       return
//     }
//     // ── End validation ──────────────────────────────────────────────────────

//     setLoading(true)

//     try {
//       const productData = {
//         barcode: form.barcode,
//         productName: form.productName,
//         productImage: form.productImage,
//         productColor: showColorField ? form.productColor : '',
//         productDescription: form.productDescription,
//         costPrice: parsedCost,
//         sellingPrice: parsedSelling,
//         quantity: parsedStock,
//         categoryId: form.categoryId || null,
//         sku: form.sku || undefined,
//       }

//       const response = await apiClient.createProductWithGlobalSync(productData)
//       setSelectedCatalogProduct(null)
//       setSuccess(response.message || 'Product created and synced to global catalog successfully!')
//       setTimeout(() => navigate('/dashboard/products'), 1500)
//     } catch (err: any) {
//       setError(err.message)
//     } finally {
//       setLoading(false)
//     }
//   }

//   if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'OWNER' && user.role !== 'MANAGER')) {
//     return <div>Access denied</div>
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
//       <div className="w-full max-w-2xl bg-white rounded-xl shadow border p-8">
//         <h1 className="text-2xl font-bold text-blue-600 mb-2">Create New Product</h1>
//         <p className="text-gray-800 mb-6">Fill in the details below to add a new product.</p>
//         {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
//         {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

//         <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
//           <h2 className="text-lg font-semibold text-gray-800">Community Catalog</h2>
//           <p className="text-sm text-gray-600">Search the shared Nigerian product database before you add a new item.</p>
//           <GlobalCatalogSearch
//             onProductFound={handleProductFound}
//             onProductNotFound={handleProductNotFound}
//             className="mt-4"
//           />
//           {catalogHint && (
//             <p className="mt-3 text-sm text-gray-700">{catalogHint}</p>
//           )}
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-5 text-gray-800">
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <div>
//               <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
//                 Product Name *
//               </label>
//               <Input
//                 name="productName"
//                 placeholder="e.g. Indomie Chicken 70g"
//                 value={form.productName}
//                 onChange={handleChange}
//                 required
//                 className="text-gray-800"
//               />
//             </div>
//             <div>
//               <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
//                 Barcode *
//               </label>
//               <Input
//                 name="barcode"
//                 placeholder="e.g. 1234567890123"
//                 value={form.barcode}
//                 onChange={handleChange}
//                 required
//                 className="text-gray-800"
//               />
//               <BarcodeGlobalLookup
//                 barcode={form.barcode}
//                 onProductFound={handleProductFound}
//                 onProductNotFound={handleProductNotFound}
//                 autoLookup={!!form.barcode}
//                 className="mt-4"
//               />
//             </div>
//           </div>

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <div>
//               <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#6b7280' }}>
//                 Product Photo (optional)
//               </label>

//               {imagePreview && (
//                 <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
//                   <img
//                     src={imagePreview}
//                     alt="Preview"
//                     style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
//                   />
//                   <button
//                     type="button"
//                     onClick={() => { setImageFile(null); setImagePreview(''); setForm(f => ({ ...f, productImage: '' })) }}
//                     style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
//                   >
//                     ✕
//                   </button>
//                 </div>
//               )}

//               <label
//                 htmlFor="product-image-input"
//                 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', border: '1.5px dashed #d1d5db', borderRadius: 8, fontSize: 13, color: '#6b7280', background: '#f9fafb' }}
//               >
//                 📷 {imagePreview ? 'Change photo' : 'Add photo'}
//               </label>
//               <input
//                 id="product-image-input"
//                 type="file"
//                 accept="image/*"
//                 capture="environment"
//                 style={{ display: 'none' }}
//                 onChange={async (e) => {
//                   const file = e.target.files?.[0]
//                   if (!file) return
//                   setImageFile(file)

//                   try {
//                     const compressed = await compressImage(file)
//                     setImagePreview(compressed)
//                     setForm(f => ({ ...f, productImage: compressed }))
//                   } catch {
//                     // Compression failed — fall back to raw FileReader
//                     const reader = new FileReader()
//                     reader.onloadend = () => {
//                       const result = reader.result as string
//                       setImagePreview(result)
//                       setForm(f => ({ ...f, productImage: result }))
//                     }
//                     reader.readAsDataURL(file)
//                   }
//                 }}
//               />
//             </div>
//             <div>
//               <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
//                 SKU (Optional)
//               </label>
//               <Input
//                 name="sku"
//                 placeholder="e.g. INDM-70G-CHICK"
//                 value={form.sku}
//                 onChange={handleChange}
//                 className="text-gray-800"
//               />
//             </div>
//           </div>

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             {showColorField && (
//               <div>
//                 <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
//                   Product Color
//                 </label>
//                 <Input
//                   name="productColor"
//                   placeholder="e.g. Red, Blue, Black"
//                   value={form.productColor}
//                   onChange={handleChange}
//                   className="text-gray-800"
//                 />
//               </div>
//             )}
//             <select
//               name="categoryId"
//               value={form.categoryId}
//               onChange={handleChange}
//               className="border rounded-md px-3 py-2 w-full text-gray-800"
//               disabled={categoriesLoading}
//             >
//               <option value="">
//                 {categoriesLoading ? 'Loading categories...' : 'Select Category (Optional)'}
//               </option>
//               {categories.map(category => (
//                 <option key={category.id} value={category.id}>
//                   {category.categoryName}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div>
//             <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
//               Product Description
//             </label>
//             <Input
//               name="productDescription"
//               placeholder="e.g. Instant noodles, chicken flavour, single pack"
//               value={form.productDescription}
//               onChange={handleChange}
//               className="text-gray-800"
//             />
//           </div>

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <div>
//               <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
//                 Cost Price *
//               </label>
//               <Input
//                 name="costPrice"
//                 type="number"
//                 step="1"
//                 aria-label="Buying Price (what YOU paid) *"
//                 placeholder="e.g. 150"
//                 value={form.costPrice}
//                 onChange={handleChange}
//                 required
//                 className="text-gray-800"
//               />
//             </div>
//             <div>
//               <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
//                 Selling Price *
//               </label>
//               <Input
//                 name="sellingPrice"
//                 type="number"
//                 step="1"
//                 aria-label="Selling Price (what customers pay) *"
//                 placeholder="e.g. 200"
//                 value={form.sellingPrice}
//                 onChange={handleChange}
//                 required
//                 className="text-gray-800"
//               />
//             </div>
//           </div>
//           {form.costPrice && form.sellingPrice &&
//             parseFloat(form.sellingPrice) > parseFloat(form.costPrice) && (
//               <p style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
//                 ✓ You will make ₦{(parseFloat(form.sellingPrice) - parseFloat(form.costPrice)).toLocaleString('en-NG')} profit per unit
//                 ({Math.round(((parseFloat(form.sellingPrice) - parseFloat(form.costPrice)) / parseFloat(form.sellingPrice)) * 100)}% margin)
//               </p>
//             )}
//           {form.costPrice && form.sellingPrice &&
//             parseFloat(form.sellingPrice) <= parseFloat(form.costPrice) && (
//               <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
//                 ⚠ Selling price is lower than or equal to buying price — you will not make a profit
//               </p>
//             )}

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <div>
//               <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
//                 How many do you have right now?
//               </label>
//               <Input
//                 name="stock"
//                 type="number"
//                 placeholder="How many do you have right now?"
//                 value={form.stock}
//                 onChange={handleChange}
//                 className="text-gray-800"
//               />
//             </div>
//           </div>

//           <div className="flex gap-4 justify-end">
//             <Button
//               type="submit"
//               disabled={loading}
//               className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150"
//             >
//               {loading ? 'Creating...' : 'Create Product'}
//             </Button>
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => navigate('/dashboard/products')}
//               className="bg-gray-400 hover:bg-gray-800 hover:text-white text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150"
//             >
//               Cancel
//             </Button>
//           </div>
//         </form>
//       </div>
//     </div>
//   )
// }

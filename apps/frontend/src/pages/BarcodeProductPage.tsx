import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

type ScanStep = 'scan' | 'looking-up' | 'confirm'

interface Category {
  id: string
  categoryName: string
}

interface BarcodeLookupResult {
  barcode: string
  productName: string | null
  description: string | null
  image: string | null
  brand: string | null
  source: 'internal' | 'openfoodfacts' | 'upcitemdb' | 'none'
  found: boolean
}

export const BarcodeProductPage = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<ScanStep>('scan')
  const [barcode, setBarcode] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [productFound, setProductFound] = useState(false)
  const [form, setForm] = useState({
    productName: '',
    productDescription: '',
    productImage: '',
    productColor: '',
    costPrice: '',
    sellingPrice: '',
    stock: '',
    categoryId: '',
  })

  const barcodeDetectorSupported =
    typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'OWNER' && user.role !== 'MANAGER')) {
      navigate('/dashboard')
      return
    }
  }, [user, navigate])

  useEffect(() => {
    const loadCategories = async () => {
      setCategoriesLoading(true)
      try {
        const categoriesData = await apiClient.getCategories()
        setCategories(categoriesData)
      } catch (error) {
        console.error('Failed to load categories:', error)
      } finally {
        setCategoriesLoading(false)
      }
    }

    if (token) {
      loadCategories()
    }
  }, [token])

  const resetFlow = () => {
    setStep('scan')
    setBarcode('')
    setLookupError(null)
    setSaveError(null)
    setProductFound(false)
    setForm({
      productName: '',
      productDescription: '',
      productImage: '',
      productColor: '',
      costPrice: '',
      sellingPrice: '',
      stock: '',
      categoryId: '',
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleScanButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStep('looking-up')
    setLookupError(null)
    setSaveError(null)

    try {
      let detectedBarcode = ''

      if (barcodeDetectorSupported) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        })
        const bitmap = await createImageBitmap(file)
        const barcodes = await detector.detect(bitmap)
        if (barcodes.length > 0) {
          detectedBarcode = barcodes[0].rawValue || ''
        }
      }

      if (!detectedBarcode) {
        setStep('scan')
        setLookupError(
          'Could not read the barcode automatically. Type the barcode number below and tap "Look up".'
        )
        return
      }

      await lookupBarcode(detectedBarcode)
    } catch (err) {
      setStep('scan')
      setLookupError(
        'Could not scan the barcode. Try typing the number manually below.'
      )
    } finally {
      e.target.value = ''
    }
  }

  const lookupBarcode = async (code: string) => {
    setBarcode(code)
    setStep('looking-up')
    setLookupError(null)
    setSaveError(null)
    setProductFound(false)

    try {
      const data = await apiClient.lookupBarcode(code) as BarcodeLookupResult
      setProductFound(Boolean(data?.found))
      setForm(prev => ({
        ...prev,
        productName: data?.productName || '',
        productDescription: data?.description || data?.brand || '',
        productImage: data?.image || '',
        productColor: '',
      }))
      setStep('confirm')
    } catch {
      setForm(prev => ({
        ...prev,
        productName: '',
        productDescription: '',
        productImage: '',
        productColor: '',
      }))
      setStep('confirm')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setSaveError(null)

    try {
      await apiClient.createProduct({
        barcode,
        productName: form.productName,
        productDescription: form.productDescription,
        productImage: form.productImage,
        productColor: form.productColor,
        costPrice: parseFloat(form.costPrice),
        sellingPrice: parseFloat(form.sellingPrice),
        stock: parseInt(form.stock) || 0,
        quantity: parseInt(form.stock) || 0,
        categoryId: form.categoryId || null,
        globalizeOnSave: !productFound,
      })
      navigate('/dashboard/products')
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save product. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'OWNER' && user.role !== 'MANAGER')) {
    return <div>Access denied</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow border p-8">
        {step === 'scan' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <button
                type="button"
                onClick={() => navigate('/dashboard/products')}
                style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-blue-600">Scan Barcode</h1>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: 32,
                textAlign: 'center',
                background: '#f8fafc',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Scan product barcode
              </h2>
              <p style={{ color: '#475569', fontSize: 15, marginBottom: 24 }}>
                Point your camera at the barcode on the product.
              </p>

              <Button
                type="button"
                onClick={handleScanButtonClick}
                style={{
                  background: '#D4AF37',
                  color: '#fff',
                  border: 'none',
                  minWidth: 220,
                  fontWeight: 700,
                }}
              >
                📷 Open Camera / Scan
              </Button>

              <div style={{ marginTop: 24, color: '#64748b', fontSize: 14, fontWeight: 600 }}>
                ── or type the barcode ──
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Or type barcode number..."
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  style={{
                    flex: 1, padding: '10px 14px',
                    border: '1.5px solid #e2e8f0', borderRadius: 10,
                    fontSize: 15, outline: 'none', color: '#0f172a',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#D4AF37')}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                />
                <button
                  type="button"
                  onClick={() => barcode.trim() && lookupBarcode(barcode.trim())}
                  disabled={!barcode.trim()}
                  style={{
                    padding: '10px 18px', background: '#D4AF37', color: '#fff',
                    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: barcode.trim() ? 'pointer' : 'not-allowed',
                    opacity: barcode.trim() ? 1 : 0.5,
                  }}
                >
                  Look up
                </button>
              </div>

              {lookupError && (
                <p style={{ color: '#dc2626', fontSize: 14, marginTop: 16 }}>
                  {lookupError}
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </>
        )}

        {step === 'looking-up' && (
          <div
            style={{
              minHeight: 360,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <h1 className="text-2xl font-bold text-blue-600 mb-3">Searching product database...</h1>
            <p style={{ color: '#334155', fontSize: 16, marginBottom: 20 }}>
              ⏳ Looking up barcode {barcode || '...'}
            </p>
            <div
              style={{
                width: 40,
                height: 40,
                border: '4px solid #e2e8f0',
                borderTopColor: '#D4AF37',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <style>
              {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
            </style>
          </div>
        )}

        {step === 'confirm' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={resetFlow}
                style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}
              >
                ← Scan another
              </button>
              <h1 className="text-2xl font-bold text-blue-600">Add Product</h1>
            </div>

            {productFound ? (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 20,
                  color: '#166534',
                }}
              >
                ✓ Product found! Check the details below and add prices.
              </div>
            ) : (
              <div
                style={{
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 20,
                  color: '#9a3412',
                }}
              >
                <p style={{ fontWeight: 700, marginBottom: 4 }}>Barcode: {barcode}</p>
                <p>Product not found in database. Fill in the details manually.</p>
              </div>
            )}

            {saveError && <p className="text-red-500 text-sm mb-4">{saveError}</p>}

            <form onSubmit={handleSubmit} className="space-y-5 text-gray-800">
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Barcode
                </label>
                <div
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: 15,
                  }}
                >
                  {barcode || 'No barcode scanned'}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Category
                </label>
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
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.categoryName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Description
                </label>
                <textarea
                  name="productDescription"
                  placeholder="Describe the product"
                  value={form.productDescription}
                  onChange={handleChange}
                  rows={3}
                  style={{
                    width: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: '#1f2937',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Buying price (what YOU paid) *
                  </label>
                  <Input
                    name="costPrice"
                    type="number"
                    step="1"
                    placeholder="e.g. 150"
                    value={form.costPrice}
                    onChange={handleChange}
                    required
                    className="text-gray-800"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Selling price (what customers pay) *
                  </label>
                  <Input
                    name="sellingPrice"
                    type="number"
                    step="1"
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
                  ✓ You will make ₦
                  {(parseFloat(form.sellingPrice) - parseFloat(form.costPrice))
                    .toLocaleString('en-NG')} profit per unit
                </p>
              )}
              {form.costPrice && form.sellingPrice &&
                parseFloat(form.sellingPrice) <= parseFloat(form.costPrice) && (
                <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                  ⚠ Selling price is lower than buying price — you will not make a profit
                </p>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  How many do you have right now? *
                </label>
                <Input
                  name="stock"
                  type="number"
                  placeholder="How many do you have right now?"
                  value={form.stock}
                  onChange={handleChange}
                  required
                  className="text-gray-800"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Product Image
                </label>
                {form.productImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={form.productImage}
                      alt={form.productName || 'Product preview'}
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, productImage: '' }))}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        background: '#fff',
                        color: '#ef4444',
                        fontWeight: 600,
                      }}
                    >
                      Clear image
                    </button>
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontSize: 14 }}>No product image available.</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  style={{ background: '#D4AF37', color: '#fff', fontWeight: 700 }}
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

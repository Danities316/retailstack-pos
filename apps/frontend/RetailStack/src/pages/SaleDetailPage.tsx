import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface SaleItem {
  id: string
  productId: string
  quantity: number
  price: number
  product: {
    productName: string
  }
}

interface Sale {
  id: string
  totalAmount: number
  paymentMethod: string
  createdAt: string
  items: SaleItem[]
  isOffline?: boolean
}

export const SaleDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSale = async () => {
      if (!id || !token) return

      try {
        setLoading(true)
        const saleData = await apiClient.request(`/sales/${id}`)
        setSale(saleData)
      } catch (error) {
        setError('Failed to load sale details')
        console.error('Error loading sale:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSale()
  }, [id, token])

  const handleDelete = async () => {
    if (!sale || !confirm('Are you sure you want to delete this sale?')) return

    try {
      await apiClient.request(`/sales/${sale.id}`, { method: 'DELETE' })
      navigate('/dashboard/sales')
    } catch (error) {
      console.error('Failed to delete sale:', error)
      setError('Failed to delete sale')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const safeNumber = (value: any): number => {
    return typeof value === 'number' ? value : Number(value) || 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading sale details...</p>
      </div>
    )
  }

  if (error || !sale) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error || 'Sale not found'}</p>
          <Button onClick={() => navigate('/dashboard/sales')}>
            Back to Sales
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-blue-600 font-semibold">Sale Details</h1>
          <p className="text-gray-600">Sale ID: {sale.id}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/sales">
            <Button variant="outline">Back to Sales</Button>
          </Link>
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER') && (
            <Button
              variant="outline"
              className="text-red-600"
              onClick={handleDelete}
            >
              Delete Sale
            </Button>
          )}
        </div>
      </div>

      {/* Sale Information */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg text-blue-600 font-semibold mb-4">Sale Information</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-600">Date:</span>
                <span className="ml-2 font-medium">{formatDate(sale.createdAt)}</span>
              </div>
              <div>
                <span className="text-gray-600">Payment Method:</span>
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800' :
                  sale.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {sale.paymentMethod}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total Amount:</span>
                <span className="ml-2 font-bold text-xl">₦{safeNumber(sale.totalAmount).toFixed(2)}</span>
              </div>
              {sale.isOffline && (
                <div>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                    Offline Sale
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg text-blue-600 font-semibold mb-4">Items</h2>
          <div className="space-y-4">
            {sale.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                <div>
                  <h3 className="font-medium">{item.product.productName}</h3>
                  <p className="text-sm text-gray-600">
                    Quantity: {item.quantity} × ${safeNumber(item.price).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                  ₦{(safeNumber(item.price) * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Total */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl text-blue-600 font-bold">₦{safeNumber(sale.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
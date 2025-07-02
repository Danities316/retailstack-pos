import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
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

export const SalesPage = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  // Load sales
  useEffect(() => {
    const loadSales = async () => {
      try {
        setLoading(true)
        const salesData = await apiClient.request('/sales')
        setSales(salesData)
      } catch (error) {
        setError('Failed to load sales')
        console.error('Error loading sales:', error)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadSales()
    }
  }, [token])

  const handleDelete = async (saleId: string) => {
    if (!confirm('Are you sure you want to delete this sale?')) return

    try {
      await apiClient.request(`/sales/${saleId}`, { method: 'DELETE' })
      setSales(sales.filter(s => s.id !== saleId))
    } catch (error) {
      console.error('Failed to delete sale:', error)
    }
  }

  const filteredSales = sales.filter(sale => {
    const matchesSearch = sale.items.some(item => 
      item.product.productName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const matchesPayment = !filterPayment || sale.paymentMethod === filterPayment
    const matchesDate = !dateFilter || sale.createdAt.startsWith(dateFilter)
    return matchesSearch && matchesPayment && matchesDate
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const safeNumber = (value: any): number => {
    return typeof value === 'number' ? value : Number(value) || 0
  }

  const getTotalSales = () => {
    const total = filteredSales.reduce((total, sale) => {
      return total + safeNumber(sale.totalAmount)
    }, 0)
    return total
  }
 

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading sales...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl text-blue-600 font-semibold">Sales</h1>
        <Link to="/dashboard/sales/create">
          <Button className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150">Create Sale</Button>
        </Link>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Summary */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Sales</p>
            <p className="text-2xl font-bold">₦{getTotalSales().toFixed(2)}</p>
            {/* <p className="text-2xl font-bold">${getTotalSales().toFixed(2)}</p> */}
          </div>
          <div>
            <p className="text-sm text-gray-600">Number of Sales</p>
            <p className="text-2xl font-bold">{filteredSales.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Average Sale</p>
            <p className="text-2xl font-bold">
            ₦{filteredSales.length > 0 ? (getTotalSales() / filteredSales.length).toFixed(2) : '0.00'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search by product..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          <option value="">All Payment Methods</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="TRANSFER">Transfer</option>
        </select>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSales.map(sale => (
              <tr key={sale.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(sale.createdAt)}
                  {sale.isOffline && (
                    <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                      Offline
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="space-y-1">
                    {sale.items.map((item, index) => (
                      <div key={index} className="text-sm">
                        {item.product.productName} x {item.quantity} @ ₦{item.price}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800' :
                    sale.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {sale.paymentMethod}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ₦{safeNumber(sale.totalAmount).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/dashboard/sales/${sale.id}`)}
                    >
                      View
                    </Button>
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => handleDelete(sale.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSales.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No sales found</p>
        </div>
      )}
    </div>
  )
}
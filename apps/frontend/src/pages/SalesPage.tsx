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

  // Theme colors
  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#3B82F6'
  const successColor = getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim() || '#10B981'
  const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#64748B'
  const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#F8FAFC'
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#E2E8F0'

  // Load sales
  useEffect(() => {
    const loadSales = async () => {
      try {
        setLoading(true)
        const salesData = await apiClient.request('/sales')
        setSales(salesData)
      } catch (error) {
        const isOffline = !navigator.onLine
        const errorMsg = isOffline
          ? 'You are offline. No cached sales data available. Go online to load sales.'
          : 'Failed to load sales'
        setError(errorMsg)
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
        <p style={{ color: secondaryColor }}>Loading sales...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>Sales</h1>
        <Link to="/dashboard/sales/create">
          <Button
            style={{
              background: '#0f172a', borderColor: '#0f172a', color: '#D4AF37',
              fontWeight: 600,
              borderRadius: 8,
              padding: '10px 24px'
            }}
          >
            + Create Sale
          </Button>
        </Link>
      </div>

      {error && (
        <p style={{ color: '#EF4444', fontSize: 14, marginBottom: 16, padding: 12, background: '#FEE2E2', borderRadius: 8, borderLeft: `4px solid #EF4444` }}>
          {error}
        </p>
      )}

      {/* Summary Cards */}
      <div
        style={{
          background: surfaceColor,
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
          border: `1px solid ${borderColor}`
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Total Sales
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#D4AF37' }}>₦{getTotalSales().toFixed(2)}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Number of Sales
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#D4AF37' }}>{filteredSales.length}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Average Sale
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#D4AF37' }}>
              ₦{filteredSales.length > 0 ? (getTotalSales() / filteredSales.length).toFixed(2) : '0.00'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Input
          placeholder="Search by product..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            maxWidth: '320px',
            borderColor: borderColor,
            borderRadius: 8
          }}
        />
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          style={{
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 14,
            color: secondaryColor,
            background: '#fff',
            cursor: 'pointer'
          }}
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
          style={{
            maxWidth: '320px',
            borderColor: borderColor,
            borderRadius: 8
          }}
        />
      </div>

      {/* Sales Table */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: surfaceColor, borderBottom: `1px solid ${borderColor}` }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Date
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Items
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Payment Method
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: secondaryColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale, idx) => (
              <tr key={sale.id} style={{ borderBottom: `1px solid ${borderColor}`, transition: 'background 0.2s', background: idx % 2 === 0 ? '#fff' : surfaceColor + '40' }}>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#1E293B' }}>
                  {formatDate(sale.createdAt)}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#1E293B' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sale.items.map((item, index) => (
                      <div key={index} style={{ fontSize: 13 }}>
                        {item.product.productName} x {item.quantity} @ ₦{item.price}
                      </div>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#1E293B' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      borderRadius: 999,
                      fontWeight: 500,
                      display: 'inline-block',
                      ...(sale.paymentMethod === 'CASH'
                        ? { background: `${successColor}22`, color: successColor }
                        : sale.paymentMethod === 'CARD'
                          ? { background: `${primaryColor}22`, color: primaryColor }
                          : { background: `${secondaryColor}22`, color: secondaryColor }
                      )
                    }}
                  >
                    {sale.paymentMethod}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#D4AF37' }}>
                  ₦{safeNumber(sale.totalAmount).toFixed(2)}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/dashboard/sales/${sale.id}`)}
                      style={{
                        color: primaryColor,
                        borderColor: primaryColor,
                        background: 'transparent',
                        fontSize: 12,
                        padding: '6px 12px',
                        borderRadius: 6
                      }}
                    >
                      View
                    </Button>
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(sale.id)}
                        style={{
                          color: '#EF4444',
                          borderColor: '#EF4444',
                          background: 'transparent',
                          fontSize: 12,
                          padding: '6px 12px',
                          borderRadius: 6
                        }}
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
        <div style={{ textAlign: 'center', padding: 48, color: secondaryColor }}>
          <p style={{ fontSize: 16 }}>No sales found</p>
        </div>
      )}
    </div>
  )
}
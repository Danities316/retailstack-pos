import React, { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { ArrowUpRight, Lock, Package, ShoppingBag, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '../lib/apiClient'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { openDatabase, getAllFromStore } from '@/offline/db'
import { startOfDay, endOfDay, isSameDay, subDays } from 'date-fns'

interface TopProduct {
  productId: string
  productName: string
  quantitySold: number
}

interface DailySummaryData {
  totalSales: number
  transactions: number
  averageOrderValue: number
  taxCollected: number
  compareYesterday: string
  costOfGoodsSold: number | null
  grossProfit: number | null
  itemsSold: number
  topProduct: TopProduct | null
}

const formatNaira = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return 'N/A'
  const n = Number(value)
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatCount = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return 'N/A'
  return String(value)
}

const SummaryCard: React.FC<{
  title: string
  value: string
  description?: string
  accentColor: string
  locked?: boolean
}> = ({ title, value, description, accentColor, locked }) => (
  <Card
    className="p-5 rounded-2xl shadow-sm"
    style={{ border: `1px solid ${accentColor}22`, background: locked ? '#f8fafc' : '#ffffff' }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          {title}
        </div>
        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: locked ? '#94a3b8' : '#0f172a', lineHeight: 1.1 }}>
          {locked ? '??' : value}
        </div>
      </div>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: accentColor }} />
    </div>
    {description && (
      <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>{description}</div>
    )}
  </Card>
)

export const DailySummary = () => {
  const { user } = useAuth()
  const isOnline = useOnlineStatus()
  const tenantId = user?.tenantId
  const canSeeProfits = user?.role !== 'CASHIER'

  const [summary, setSummary] = useState<DailySummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offlineMode, setOfflineMode] = useState(false)

  const loadOfflineSummary = async () => {
    const db = await openDatabase()
    const allSales = await getAllFromStore(db, 'sales')
    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())
    const products = await getAllFromStore(db, 'products')

    const records = Array.isArray(allSales) ? allSales : []
    const todaysSales = records.filter((record: any) => {
      if (!record || record.tenantId !== tenantId || !record.data) return false
      const created = record.data.createdAt ? new Date(record.data.createdAt) : null
      return created instanceof Date && !Number.isNaN(created.getTime()) && created >= todayStart && created <= todayEnd
    })

    const totalSales = todaysSales.reduce((sum: number, sale: any) => sum + Number(sale.data?.totalAmount || 0), 0)
    const transactions = todaysSales.length
    const taxCollected = todaysSales.reduce((sum: number, sale: any) => sum + Number(sale.data?.taxAmount || 0), 0)

    const productCounts = new Map<string, { productName: string; quantity: number }>()
    todaysSales.forEach((sale: any) => {
      const items = Array.isArray(sale.data?.items) ? sale.data.items : []
      items.forEach((item: any) => {
        const productId = item.productId || 'unknown'
        const nameFromItem = item.productName || ''
        const existing = productCounts.get(productId)
        const itemName = nameFromItem || (() => {
          const match = products.find((product: any) => product.id === productId || product.data?.id === productId)
          return match?.data?.productName || match?.productName || productId
        })()
        if (!existing) {
          productCounts.set(productId, { productName: itemName, quantity: Number(item.quantity || 0) })
        } else {
          existing.quantity += Number(item.quantity || 0)
        }
      })
    })

    const itemsSold = Array.from(productCounts.values()).reduce((sum, item) => sum + item.quantity, 0)
    const topProductEntry = Array.from(productCounts.entries())
      .sort(([, a], [, b]) => b.quantity - a.quantity)[0]

    const topProduct = topProductEntry
      ? {
        productId: topProductEntry[0],
        productName: topProductEntry[1].productName,
        quantitySold: topProductEntry[1].quantity,
      }
      : null

    setOfflineMode(true)
    setSummary({
      totalSales,
      transactions,
      averageOrderValue: transactions > 0 ? totalSales / transactions : 0,
      taxCollected,
      compareYesterday: 'Offline totals only',
      costOfGoodsSold: null,
      grossProfit: null,
      itemsSold,
      topProduct,
    })
  }

  const loadOnlineSummary = async () => {
    const data = await apiClient.getDailySummary(tenantId || '', user ? localStorage.getItem('auth_token') || undefined : undefined)
    const parsed = {
      totalSales: Number(data.totalSales || 0),
      transactions: Number(data.transactions || 0),
      averageOrderValue: Number(data.averageOrderValue || 0),
      taxCollected: Number(data.taxCollected || 0),
      compareYesterday: String(data.compareYesterday || '�'),
      costOfGoodsSold: data.costOfGoodsSold == null ? null : Number(data.costOfGoodsSold),
      grossProfit: data.grossProfit == null ? null : Number(data.grossProfit),
      itemsSold: Number(data.itemsSold || 0),
      topProduct: data.topProduct ? {
        productId: data.topProduct.productId,
        productName: data.topProduct.productName,
        quantitySold: Number(data.topProduct.quantitySold || 0),
      } : null,
    }

    setOfflineMode(false)
    setSummary(parsed)
  }

  useEffect(() => {
    if (!tenantId) return
    let active = true
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        if (isOnline) {
          await loadOnlineSummary()
        } else {
          await loadOfflineSummary()
        }
      } catch (err: any) {
        if (!active) return
        setError(err?.message || 'Unable to load daily summary')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [isOnline, tenantId])

  const hasSales = summary?.transactions > 0 && summary.totalSales > 0
  const showLockedProfit = !canSeeProfits
  const profitUnavailable = summary?.grossProfit == null || summary?.costOfGoodsSold == null

  const topProductLabel = summary?.topProduct?.productName ? `${summary.topProduct.productName} (${summary.topProduct.quantitySold} sold)` : 'Top product unavailable offline'

  if (!tenantId) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} style={{ minHeight: 120, borderRadius: 20, background: 'linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
          ))}
          <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
      ) : error ? (
        <Card className="p-5 rounded-2xl border border-red-200 bg-red-50">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} style={{ color: '#b91c1c' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b' }}>Unable to load daily summary</div>
              <div style={{ marginTop: 4, color: '#7f1d1d' }}>{error}</div>
            </div>
          </div>
        </Card>
      ) : !summary ? null : (
        <div style={{ display: 'grid', gap: 16 }}>
          {offlineMode && (
            <Card className="p-4 rounded-2xl border border-orange-200 bg-orange-50" style={{ color: '#92400e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} />
                <div>
                  Offline mode enabled. Showing local sales data only. Profit and Cost of Goods Sold(COGS) are unavailable until the device reconnects.
                </div>
              </div>
            </Card>
          )}

          {hasSales ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <SummaryCard
                title="Total Sales"
                value={formatNaira(summary.totalSales)}
                description={`Compared to yesterday: ${summary.compareYesterday}`}
                accentColor="#D4AF37"
              />
              <SummaryCard
                title="Transactions"
                value={formatCount(summary.transactions)}
                description={`Avg sale: ${formatNaira(summary.averageOrderValue)}`}
                accentColor="#2563eb"
              />
              <SummaryCard
                title="Items Sold"
                value={formatCount(summary.itemsSold)}
                description={offlineMode ? 'Local item count from today' : 'Total products sold today'}
                accentColor="#7c3aed"
              />
              <SummaryCard
                title="Gross Profit"
                value={showLockedProfit ? '' : profitUnavailable ? 'N/A' : formatNaira(summary.grossProfit)}
                description={showLockedProfit ? 'Restricted by role' : profitUnavailable ? 'Missing cost price data' : 'Sales minus Cost of Goods Sold'}
                accentColor="#16a34a"
                locked={showLockedProfit}
              />
              <SummaryCard
                title="Cost of Goods Sold"
                value={showLockedProfit ? '' : profitUnavailable ? 'N/A' : formatNaira(summary.costOfGoodsSold)}
                description={showLockedProfit ? 'Restricted by role' : profitUnavailable ? 'Missing cost price data' : 'Cost of goods sold today'}
                accentColor="#ef4444"
                locked={showLockedProfit}
              />
            </div>
          ) : (
            <Card className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>No sales recorded today</div>
              <div style={{ marginTop: 8, color: '#64748b' }}>
                {offlineMode
                  ? 'Your device is offline. Any local sales will appear here once they are added.'
                  : 'There are no completed sales for today yet. Use the POS terminal to start processing sales.'}
              </div>
            </Card>
          )}

          {!offlineMode && summary.topProduct && canSeeProfits && (
            <Card className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Package size={20} style={{ color: '#7c3aed' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Top product today</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{summary.topProduct.productName}</div>
                  <div style={{ marginTop: 3, fontSize: 12, color: '#64748b' }}>{summary.topProduct.quantitySold} units sold</div>
                </div>
                <div style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }}>Based on today&apos;s sales</div>
              </div>
            </Card>
          )}

          {!offlineMode && !summary.topProduct && canSeeProfits && (
            <Card className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Package size={20} style={{ color: '#7c3aed' }} />
                <div style={{ color: '#64748b' }}>Top product is not available for today.</div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

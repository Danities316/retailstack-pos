import React, { useEffect, useState } from 'react'
import { SalesSummary } from '../components/SalesSummary'
import { SalesChart } from '../components/SalesChart'
import { QuickStats } from '../components/QuickStats'
import { DailySummary } from '../components/DailySummary'
import { SummaryCards } from '../components/SummaryCards'
import { QuickActions } from '../components/QuickActions'
import { BusinessHealth } from '../components/BusinessHealth'
import { TopProducts } from '../components/TopProducts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  PlusIcon, ShoppingBag, ArrowRight, Loader2,
  TrendingUp, Clock, RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '../lib/apiClient'

const GOLD = '#D4AF37'

// Greeting based on time of day — relevant for Nigerian business hours
const getGreeting = (): string => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Nigerian date format
const formatDate = (): string =>
  new Date().toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

export const OwnerDashboard = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [quickStats, setQuickStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [errorStats, setErrorStats] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const fetchStats = async () => {
    if (!user?.tenantId || !token) return
    setLoadingStats(true)
    setErrorStats(null)
    try {
      const data = await apiClient.getDashboardStats(user.tenantId, token)
      setQuickStats(data)
      setLastRefreshed(new Date())
    } catch (err: any) {
      setErrorStats(err.message || 'Error fetching stats')
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => { fetchStats() }, [user?.tenantId, token])

  return (
    <div className="space-y-6 p-4 md:p-0">

      {/* ── Dashboard header ─────────────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, #fffbeb 0%, #fef9c3 60%, #fff 100%)`,
          border: `1px solid ${GOLD}33`,
          borderRadius: 16,
          padding: '24px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
            {formatDate()}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
            {getGreeting()},{' '}
            <span style={{ color: GOLD }}>{user?.name || 'Owner'}</span> 👋
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>
            Here's your store performance overview for today.
          </p>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
              fontSize: 11.5, color: '#92400e',
            }}
          >
            <RefreshCw size={11} />
            Last refreshed: {lastRefreshed.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
            <button
              onClick={fetchStats}
              style={{
                background: GOLD + '22', border: `1px solid ${GOLD}44`,
                color: '#92400e', borderRadius: 6, padding: '2px 8px',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', marginLeft: 4,
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button
            style={{ background: GOLD, color: '#fff', borderRadius: 10, fontWeight: 700 }}
            onClick={() => navigate('/dashboard/sales/new')}
          >
            <PlusIcon size={15} style={{ marginRight: 6 }} />
            New Sale
          </Button>
          <Button
            variant="outline"
            style={{ borderColor: GOLD + '66', color: '#92400e', borderRadius: 10, fontWeight: 600 }}
            onClick={() => navigate('/dashboard/reports')}
          >
            <TrendingUp size={15} style={{ marginRight: 6 }} />
            View Reports
          </Button>
        </div>
      </div>

      {/* ── Today Summary Cards ─────────────────────────────────────────── */}
      <SummaryCards />

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <QuickActions />

      {/* ── Business Health ──────────────────────────────────────────────── */}
      <BusinessHealth />

      {/* ── Top Selling Products ─────────────────────────────────────────── */}
      <TopProducts />

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      {loadingStats ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
          }}
        >
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 130, borderRadius: 16,
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s infinite',
              }}
            />
          ))}
          <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
      ) : errorStats ? (
        <div
          style={{
            padding: '16px 20px', borderRadius: 12,
            background: '#fef2f2', border: '1px solid #fecaca',
            color: '#dc2626', fontSize: 14,
          }}
        >
          ⚠️ {errorStats}
        </div>
      ) : quickStats ? (
        <>
          <QuickStats stats={quickStats} />
          <div style={{ marginTop: 18 }}>
            {/* <DailySummary /> */}
          </div>
        </>
      ) : null}

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          {user?.tenantId && (
            <SalesChart tenantId={user.tenantId} token={token || undefined} />
          )}
        </div>
      </div> */}

      {/* ── Recent Sales Summary ─────────────────────────────────────────── */}
      {user?.tenantId && (
        <SalesSummary tenantId={user.tenantId} token={token || undefined} />
      )}
    </div>
  )
}
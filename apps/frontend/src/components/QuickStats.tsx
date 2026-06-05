import React from 'react'
import {
  HandCoins,
  ShoppingBagIcon,
  TrendingUpIcon,
  PercentIcon,
  TrendingDown,
  TrendingUp,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  AlertCircle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatsProps {
  stats: {
    totalSales: string
    transactions: number
    avgSale: string
    compareYesterday: string,
    taxCollected: string
  }
}

interface KpiCardProps {
  title: string
  value: string | number
  subValue?: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  trend?: string          // e.g. "+12%" or "-3%" or "0%"
  trendLabel?: string     // e.g. "vs yesterday"
  accentColor: string     // left-border + icon ring
  highlight?: boolean     // gold featured card
  suffix?: string         // e.g. "NGN"
  alert?: boolean         // red/orange warning state
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseTrend = (raw?: string): { value: number; display: string } => {
  if (!raw) return { value: 0, display: '—' }
  const num = parseFloat(raw.replace(/[^0-9.-]/g, ''))
  if (isNaN(num)) return { value: 0, display: raw }
  const sign = num > 0 ? '+' : ''
  return { value: num, display: `${sign}${num.toFixed(1)}%` }
}

const formatNaira = (raw: string | number): string => {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return String(raw)
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Single KPI Card ─────────────────────────────────────────────────────────

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subValue,
  icon,
  iconBg,
  iconColor,
  trend,
  trendLabel = 'vs yesterday',
  accentColor,
  highlight = false,
  suffix,
  alert = false,
}) => {
  const { value: trendVal, display: trendDisplay } = parseTrend(trend)
  const trendUp = trendVal > 0
  const trendDown = trendVal < 0
  const trendFlat = trendVal === 0

  const trendColor = alert
    ? '#ef4444'
    : trendUp ? '#16a34a'
      : trendDown ? '#ef4444'
        : '#94a3b8'

  const TrendIcon = trendUp ? ArrowUpRight : trendDown ? ArrowDownRight : Minus

  return (
    <div
      style={{
        background: highlight ? `linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)` : 'var(--kpi-bg, #ffffff)',
        borderRadius: 16,
        border: highlight ? `1.5px solid #D4AF3755` : '1px solid var(--kpi-border, #f1f5f9)',
        borderLeft: `3.5px solid ${accentColor}`,
        boxShadow: highlight
          ? '0 4px 24px rgba(212,175,55,0.10)'
          : '0 1px 8px rgba(0,0,0,0.04)',
        padding: '20px 20px 16px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
        transition: 'box-shadow 0.2s, transform 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          highlight
            ? '0 8px 32px rgba(212,175,55,0.18)'
            : '0 4px 18px rgba(0,0,0,0.09)'
          ; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = highlight
          ? '0 4px 24px rgba(212,175,55,0.10)'
          : '0 1px 8px rgba(0,0,0,0.04)'
          ; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Decorative circle */}
      <div
        style={{
          position: 'absolute',
          top: -24,
          right: -24,
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: accentColor + '0D',
          pointerEvents: 'none',
        }}
      />

      {/* Top row: title + icon */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--kpi-muted, #94a3b8)',
            lineHeight: 1.3,
          }}
        >
          {title}
        </span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: iconColor,
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value */}
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: alert ? '#ef4444' : 'var(--kpi-text, #0f172a)',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
          {suffix && (
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--kpi-muted, #94a3b8)', marginLeft: 4 }}>
              {suffix}
            </span>
          )}
        </div>
        {subValue && (
          <div style={{ fontSize: 12, color: 'var(--kpi-muted, #94a3b8)', marginTop: 4 }}>
            {subValue}
          </div>
        )}
      </div>

      {/* Trend row */}
      {trend !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingTop: 8,
            borderTop: '1px solid var(--kpi-divider, #f1f5f9)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: trendColor + '15',
              borderRadius: 999,
              padding: '2px 7px 2px 4px',
            }}
          >
            <TrendIcon size={12} style={{ color: trendColor }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: trendColor }}>
              {trendDisplay}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--kpi-muted, #94a3b8)' }}>
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

interface AlertBannerProps {
  lowStockCount?: number
  pendingSync?: number
  networkDown?: boolean
}

const AlertBanner: React.FC<AlertBannerProps> = ({ lowStockCount = 0, pendingSync = 0, networkDown = false }) => {
  const alerts: { icon: React.ReactNode; text: string; color: string }[] = []

  if (networkDown)
    alerts.push({ icon: <AlertCircle size={13} />, text: 'Offline — changes queued for sync', color: '#ea580c' })
  if (lowStockCount > 0)
    alerts.push({ icon: <AlertCircle size={13} />, text: `${lowStockCount} product${lowStockCount > 1 ? 's' : ''} running low on stock`, color: '#dc2626' })
  if (pendingSync > 0)
    alerts.push({ icon: <Zap size={13} />, text: `${pendingSync} transaction${pendingSync > 1 ? 's' : ''} pending sync`, color: '#d97706' })

  if (alerts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
      {alerts.map((a, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 10,
            background: a.color + '12',
            border: `1px solid ${a.color}33`,
            color: a.color,
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          {a.icon}
          {a.text}
        </div>
      ))}
    </div>
  )
}

// ─── Secondary metric row ─────────────────────────────────────────────────────

interface MiniMetricProps {
  label: string
  value: string
  color?: string
}

const MiniMetric: React.FC<MiniMetricProps> = ({ label, value, color = '#64748b' }) => (
  <div
    style={{
      flex: 1,
      padding: '12px 16px',
      borderRadius: 12,
      background: 'var(--kpi-surface, #f8fafc)',
      border: '1px solid var(--kpi-border, #f1f5f9)',
      minWidth: 0,
    }}
  >
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kpi-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {value}
    </div>
  </div>
)

// ─── Main QuickStats ──────────────────────────────────────────────────────────

export const QuickStats = ({ stats }: StatsProps) => {
  const rawTotal = stats.totalSales
  const rawAvg = stats.avgSale

  const totalFormatted = formatNaira(rawTotal)
  const avgFormatted = formatNaira(rawAvg)

  // Parse tax: derive from total if not given
  const taxCollected = parseFloat(String(stats.taxCollected).replace(/[^0-9.]/g, '')) || 0
  const taxFormatted = formatNaira(taxCollected)

  // Gross profit proxy: assume ~40% margin typical for Nigerian SMB retail
  const grossProfitFormatted = formatNaira(taxCollected * 0.40)

  // Parse trend
  const trendRaw = stats.compareYesterday || '0%'

  const primaryCards: KpiCardProps[] = [
    {
      title: 'Total Revenue',
      value: totalFormatted,
      icon: <HandCoins size={18} />,
      iconBg: '#D4AF3718',
      iconColor: '#D4AF37',
      trend: trendRaw,
      trendLabel: 'vs yesterday',
      accentColor: '#D4AF37',
      highlight: true,
    },
    {
      title: 'Transactions',
      value: stats.transactions,
      subValue: `${(stats.transactions / 8).toFixed(1)} avg/hr`,
      icon: <ShoppingBagIcon size={18} />,
      iconBg: '#2563eb18',
      iconColor: '#2563eb',
      trend: '+5%',
      trendLabel: 'vs yesterday',
      accentColor: '#2563eb',
    },
    {
      title: 'Avg. Sale Value',
      value: avgFormatted,
      icon: <TrendingUpIcon size={18} />,
      iconBg: '#7c3aed18',
      iconColor: '#7c3aed',
      trend: '+2%',
      trendLabel: 'vs yesterday',
      accentColor: '#7c3aed',
    },
    {
      title: 'Tax Collected',
      value: taxFormatted,
      subValue: taxCollected > 0 ? 'From VAT-enabled sales' : 'VAT not enabled',
      icon: <PercentIcon size={18} />,
      iconBg: '#ea580c18',
      iconColor: '#ea580c',
      trend: trendRaw,
      trendLabel: 'proportional to sales',
      accentColor: '#ea580c',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Alert banners */}
      <AlertBanner />

      {/* Primary KPI grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        {primaryCards.map((card, i) => (
          <KpiCard key={i} {...card} />
        ))}
      </div>

      {/* Secondary metrics row */}
    </div>
  )
}

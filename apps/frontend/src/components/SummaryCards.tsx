/**
 * SummaryCards.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * TODAY SUMMARY CARDS — Step 2 implementation
 *
 * Data source : apiClient.getDailySummary()  (existing endpoint)
 *               + offline fallback via IndexedDB  (already in DailySummary)
 *
 * Role rules  :
 *   CASHIER  → Total Sales + Transactions only
 *   MANAGER / OWNER → all 4 cards (+ Gross Profit + Items Sold)
 *
 * Strategy    : Re-use the existing <DailySummary> component for all data
 *               fetching/offline logic. We add a thin wrapper here that:
 *               1. Provides a section heading
 *               2. Passes the `role` down so DailySummary can gate cards
 *
 * NOTE: DailySummary already gates the Gross Profit card via
 *       `user?.role !== 'CASHIER'` internally. Items Sold is shown to all
 *       roles in DailySummary. Per spec, Cashier should NOT see Items Sold
 *       either. Two approaches are possible:
 *
 *       A) Pass a prop to DailySummary (requires touching DailySummary).
 *       B) Keep DailySummary untouched and render our own cards here.
 *
 *       We choose Option B to keep DailySummary unchanged (safe) and give
 *       us full control over the 4-card layout specified by the PM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '../lib/apiClient'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { openDatabase, getAllFromStore } from '@/offline/db'
import { startOfDay, endOfDay } from 'date-fns'
import { AlertTriangle, Lock } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryData {
    totalSales: number
    transactions: number
    itemsSold: number
    grossProfit: number | null   // null = cost price missing → show "N/A"
    offlineMode: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatNaira = (value: number | null | undefined): string => {
    if (value == null || Number.isNaN(value)) return 'N/A'
    const n = Number(value)
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`
    return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Sub-component: individual card ──────────────────────────────────────────

interface CardProps {
    title: string
    value: string
    description?: string
    accentColor: string
    locked?: boolean
    lockedReason?: string
}

const SummaryCard: React.FC<CardProps> = ({
    title,
    value,
    description,
    accentColor,
    locked,
    lockedReason,
}) => (
    <Card
        className="p-5 rounded-2xl shadow-sm"
        style={{
            border: `1px solid ${accentColor}22`,
            background: locked ? '#f8fafc' : '#ffffff',
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#64748b',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                    }}
                >
                    {title}
                </div>

                {locked ? (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                        <Lock size={18} />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                            {lockedReason ?? 'Restricted'}
                        </span>
                    </div>
                ) : (
                    <div
                        style={{
                            marginTop: 10,
                            fontSize: 28,
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.1,
                        }}
                    >
                        {value}
                    </div>
                )}

                {description && !locked && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>{description}</div>
                )}
            </div>

            {/* accent dot */}
            <div
                style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: accentColor,
                    flexShrink: 0,
                    marginTop: 4,
                }}
            />
        </div>
    </Card>
)

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

const SkeletonGrid = ({ count }: { count: number }) => (
    <>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 14,
            }}
        >
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        height: 120,
                        borderRadius: 16,
                        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.4s infinite',
                    }}
                />
            ))}
        </div>
    </>
)

// ─── Main component ───────────────────────────────────────────────────────────

export const SummaryCards: React.FC = () => {
    const { user } = useAuth()
    const isOnline = useOnlineStatus()
    const tenantId = user?.tenantId

    // CASHIER sees only Sales + Transactions (2 cards)
    // MANAGER / OWNER see all 4 cards
    const isCashier = user?.role === 'CASHIER'
    const canSeeAll = !isCashier  // MANAGER or OWNER

    const [summary, setSummary] = useState<SummaryData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // ── Offline fetch ──────────────────────────────────────────────────────────
    const loadOffline = async () => {
        const db = await openDatabase()
        const allSales = await getAllFromStore(db, 'sales')
        const todayStart = startOfDay(new Date())
        const todayEnd = endOfDay(new Date())

        const records = Array.isArray(allSales) ? allSales : []
        const todaysSales = records.filter((record: any) => {
            if (!record || record.tenantId !== tenantId || !record.data) return false
            const created = record.data.createdAt ? new Date(record.data.createdAt) : null
            return (
                created instanceof Date &&
                !Number.isNaN(created.getTime()) &&
                created >= todayStart &&
                created <= todayEnd
            )
        })

        const totalSales = todaysSales.reduce(
            (sum: number, s: any) => sum + Number(s.data?.totalAmount || 0),
            0,
        )
        const transactions = todaysSales.length

        let itemsSold = 0
        todaysSales.forEach((sale: any) => {
            const items = Array.isArray(sale.data?.items) ? sale.data.items : []
            items.forEach((item: any) => {
                itemsSold += Number(item.quantity || 0)
            })
        })

        setSummary({
            totalSales,
            transactions,
            itemsSold,
            grossProfit: null,   // COGS unavailable offline
            offlineMode: true,
        })
    }

    // ── Online fetch ───────────────────────────────────────────────────────────
    const loadOnline = async () => {
        const token = localStorage.getItem('auth_token') || undefined
        const data = await apiClient.getDailySummary(tenantId || '', token)

        setSummary({
            totalSales: Number(data.totalSales || 0),
            transactions: Number(data.transactions || 0),
            itemsSold: Number(data.itemsSold || 0),
            // grossProfit is null when costPrice data is absent (server returns null)
            grossProfit:
                data.grossProfit == null ? null : Number(data.grossProfit),
            offlineMode: false,
        })
    }

    useEffect(() => {
        if (!tenantId) return
        let active = true
        setLoading(true)
        setError(null)

        const load = async () => {
            try {
                if (isOnline) {
                    await loadOnline()
                } else {
                    await loadOffline()
                }
            } catch (err: any) {
                if (!active) return
                setError(err?.message || 'Unable to load summary')
            } finally {
                if (!active) return
                setLoading(false)
            }
        }

        load()
        return () => { active = false }
    }, [isOnline, tenantId])

    // ── Guard ──────────────────────────────────────────────────────────────────
    if (!tenantId) return null

    // ── Loading state ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <section aria-label="Today's summary loading">
                <SkeletonGrid count={isCashier ? 2 : 4} />
            </section>
        )
    }

    // ── Error state ────────────────────────────────────────────────────────────
    if (error) {
        return (
            <Card className="p-5 rounded-2xl border border-red-200 bg-red-50">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} style={{ color: '#b91c1c' }} />
                    <div>
                        <div style={{ fontWeight: 700, color: '#991b1b' }}>Unable to load summary</div>
                        <div style={{ marginTop: 4, color: '#7f1d1d', fontSize: 13 }}>{error}</div>
                    </div>
                </div>
            </Card>
        )
    }

    // ── No data ────────────────────────────────────────────────────────────────
    if (!summary) return null

    // ── Render ─────────────────────────────────────────────────────────────────
    const gridCols = isCashier ? 2 : 4

    return (
        <section aria-label="Today's summary">
            {/* Section heading */}
            <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Today's Summary
                </h2>
                {summary.offlineMode && (
                    <p style={{ marginTop: 4, fontSize: 12, color: '#92400e' }}>
                        ⚠ Offline — showing local data only
                    </p>
                )}
            </div>

            {/* Card grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                    gap: 14,
                }}
            >
                {/* ── Card 1: Total Sales (all roles) ── */}
                <SummaryCard
                    title="Total Sales Today"
                    value={formatNaira(summary.totalSales)}
                    description={
                        summary.transactions > 0
                            ? `Avg: ${formatNaira(summary.totalSales / summary.transactions)} per sale`
                            : 'No sales yet'
                    }
                    accentColor="#D4AF37"
                />

                {/* ── Card 2: Transactions (all roles) ── */}
                <SummaryCard
                    title="Transactions"
                    value={String(summary.transactions)}
                    description="Total completed sales today"
                    accentColor="#2563eb"
                />

                {/* ── Card 3: Items Sold (Manager / Owner only) ── */}
                {canSeeAll && (
                    <SummaryCard
                        title="Items Sold"
                        value={String(summary.itemsSold)}
                        description={
                            summary.offlineMode ? 'Local count only' : 'Total units sold today'
                        }
                        accentColor="#7c3aed"
                    />
                )}

                {/* ── Card 4: Profit (Manager / Owner only) ── */}
                {canSeeAll && (
                    <SummaryCard
                        title="Profit Today"
                        value={
                            summary.offlineMode
                                ? 'N/A'
                                : summary.grossProfit == null
                                    ? 'N/A'
                                    : formatNaira(summary.grossProfit)
                        }
                        description={
                            summary.offlineMode
                                ? 'Unavailable offline'
                                : summary.grossProfit == null
                                    ? 'Cost price data missing'
                                    : 'Gross profit (Sales − COGS)'
                        }
                        accentColor="#16a34a"
                    />
                )}
            </div>
        </section>
    )
}
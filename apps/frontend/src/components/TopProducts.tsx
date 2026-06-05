/**
 * TopProducts.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * TOP SELLING PRODUCTS — Dashboard Part 2, Section 2
 *
 * Shows a ranked list of the top 5 products sold today by quantity.
 *
 * Data sources:
 *   Online  → GET /dashboard/top-products?limit=5 (new lightweight endpoint)
 *   Offline → IDB `sales` store: aggregate today's items by productId,
 *             cross-reference `products` store for names
 *             (same pattern as DailySummary.loadOfflineSummary)
 *
 * Role rule: MANAGER and OWNER only.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { apiClient } from '../lib/apiClient'
import { openDatabase, getAllFromStore } from '@/offline/db'
import { startOfDay, endOfDay } from 'date-fns'
import { Package, AlertTriangle, TrendingUp } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopProduct {
    rank: number
    productId: string
    productName: string
    quantitySold: number
}

// ─── Offline computation ──────────────────────────────────────────────────────
// Mirrors the DailySummary.loadOfflineSummary pattern — keeps things consistent.

async function computeTopProductsOffline(
    tenantId: string,
    limit = 5,
): Promise<TopProduct[]> {
    const db = await openDatabase()
    const [allSales, allProducts] = await Promise.all([
        getAllFromStore(db, 'sales'),
        getAllFromStore(db, 'products'),
    ])

    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())

    // Build a productId → productName lookup from local products store
    const productNameMap = new Map<string, string>()
    allProducts.forEach((record: any) => {
        const id = record.id
        const name = record.data?.productName ?? record.productName ?? 'Unknown'
        if (id) productNameMap.set(id, name)
    })

    // Filter today's sales for this tenant
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

    // Aggregate quantity by productId across all today's sales
    const counts = new Map<string, { productName: string; quantitySold: number }>()
    todaysSales.forEach((sale: any) => {
        const items = Array.isArray(sale.data?.items) ? sale.data.items : []
        items.forEach((item: any) => {
            const pid = item.productId
            if (!pid) return
            const qty = Number(item.quantity || 0)
            const name = productNameMap.get(pid) ?? 'Unknown'
            const existing = counts.get(pid)
            if (!existing) {
                counts.set(pid, { productName: name, quantitySold: qty })
            } else {
                existing.quantitySold += qty
            }
        })
    })

    // Sort descending by quantity, take top N, add rank
    return Array.from(counts.entries())
        .sort(([, a], [, b]) => b.quantitySold - a.quantitySold)
        .slice(0, limit)
        .map(([productId, { productName, quantitySold }], idx) => ({
            rank: idx + 1,
            productId,
            productName,
            quantitySold,
        }))
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

const GOLD = '#D4AF37'

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
    const styles: Record<number, { bg: string; color: string }> = {
        1: { bg: GOLD, color: '#fff' },
        2: { bg: '#94a3b8', color: '#fff' },
        3: { bg: '#b45309', color: '#fff' },
    }
    const s = styles[rank] ?? { bg: '#f1f5f9', color: '#64748b' }
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: s.bg,
                color: s.color,
                fontSize: 13,
                fontWeight: 800,
                flexShrink: 0,
            }}
        >
            {rank}
        </span>
    )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

const SkeletonRow: React.FC = () => (
    <div
        style={{
            height: 52,
            borderRadius: 10,
            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
        }}
    />
)

// ─── Main component ───────────────────────────────────────────────────────────

const TOP_N = 5

export const TopProducts: React.FC = () => {
    const { user, token } = useAuth()
    const isOnline = useOnlineStatus()

    const tenantId = user?.tenantId
    const role = user?.role ?? ''

    // CASHIER does not see Top Products
    if (role === 'CASHIER') return null
    if (!tenantId) return null

    const [products, setProducts] = useState<TopProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [offlineMode, setOfflineMode] = useState(false)

    const fetchTopProducts = async () => {
        setLoading(true)
        setError(null)
        try {
            if (isOnline) {
                // New endpoint: GET /dashboard/top-products?limit=5
                const data: TopProduct[] = await apiClient.getTopProducts(tenantId, token || undefined, TOP_N)
                setProducts(data)
                setOfflineMode(false)
            } else {
                const data = await computeTopProductsOffline(tenantId, TOP_N)
                setProducts(data)
                setOfflineMode(true)
            }
        } catch (err: any) {
            setError(err?.message || 'Unable to load top products')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTopProducts()
    }, [isOnline, tenantId])

    // ── Max bar width calculation ──────────────────────────────────────────────
    const maxQty = products.length > 0 ? products[0].quantitySold : 1

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <section aria-label="Top selling products">
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <TrendingUp size={16} style={{ color: GOLD }} />
                    Top Selling Products Today
                </h2>
                {offlineMode && (
                    <span style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                        ⚠ Offline — local data
                    </span>
                )}
            </div>

            <Card style={{ borderRadius: 16, padding: '18px 20px' }}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
                        {Array.from({ length: TOP_N }).map((_, i) => <SkeletonRow key={i} />)}
                    </div>
                ) : error ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', padding: '8px 0' }}>
                        <AlertTriangle size={16} />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>Unable to load top products</div>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{error}</div>
                        </div>
                    </div>
                ) : products.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 10 }}>
                        <Package size={32} style={{ color: '#cbd5e1' }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>No sales recorded today</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            {offlineMode
                                ? 'Offline — no local sales found for today.'
                                : 'Products will appear here once sales are made.'}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {products.map(product => {
                            const barPct = Math.round((product.quantitySold / maxQty) * 100)
                            const isTop = product.rank === 1

                            return (
                                <div
                                    key={product.productId}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        background: isTop ? '#fffbeb' : '#f8fafc',
                                        border: `1px solid ${isTop ? `${GOLD}33` : '#f1f5f9'}`,
                                    }}
                                >
                                    {/* Rank badge */}
                                    <RankBadge rank={product.rank} />

                                    {/* Name + bar */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {product.productName}
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{ marginTop: 5, height: 5, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${barPct}%`,
                                                    borderRadius: 99,
                                                    background: isTop ? GOLD : '#94a3b8',
                                                    transition: 'width 0.4s ease',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Units sold */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: isTop ? '#92400e' : '#334155', lineHeight: 1 }}>
                                            {product.quantitySold}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>units</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Card>
        </section>
    )
}
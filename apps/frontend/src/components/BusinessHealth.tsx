/**
 * BusinessHealth.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS HEALTH — Dashboard Part 2, Section 1
 *
 * Shows 3 signals:
 *   1. Online / Offline status       → useOnlineStatus() [existing hook]
 *   2. Pending sync count            → useOfflineSync().pendingCount [existing context]
 *   3. Low stock item count          → online: apiClient.getManagerDashboardStats()
 *                                       offline: IDB products store, stock <= 5
 *
 * Role rule: MANAGER and OWNER only. Do not render for CASHIER.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineSync } from '../context/OfflineSyncContext'
import { apiClient } from '../lib/apiClient'
import { openDatabase, getAllFromStore } from '@/offline/db'
import { Wifi, WifiOff, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 5  // Mirror of backend constant in manager.routes.ts

// ─── Types ────────────────────────────────────────────────────────────────────

interface LowStockResult {
    count: number
    items: Array<{ id: string; productName: string; stock: number }>
}

// ─── Offline low-stock computation ────────────────────────────────────────────

async function computeLowStockOffline(
    tenantId: string,
): Promise<LowStockResult> {
    const db = await openDatabase()
    const allProducts = await getAllFromStore(db, 'products')

    const low = allProducts.filter((record: any) => {
        if (!record || record.tenantId !== tenantId) return false
        // Products are stored as OfflineEntity: { id, tenantId, data: {...}, meta }
        const stock = record.data?.stock ?? record.stock ?? null
        return stock !== null && Number(stock) <= LOW_STOCK_THRESHOLD
    })

    return {
        count: low.length,
        items: low.slice(0, 5).map((record: any) => ({
            id: record.id,
            productName: record.data?.productName ?? record.productName ?? 'Unknown',
            stock: Number(record.data?.stock ?? record.stock ?? 0),
        })),
    }
}

// ─── Sub-component: health indicator pill ─────────────────────────────────────

interface PillProps {
    label: string
    value: string | number
    icon: React.ReactNode
    tone: 'green' | 'red' | 'amber' | 'blue' | 'slate'
    description?: string
}

const TONES: Record<PillProps['tone'], { bg: string; border: string; text: string; dot: string }> = {
    green: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#22c55e' },
    red: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', dot: '#ef4444' },
    amber: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#f59e0b' },
    blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#3b82f6' },
    slate: { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', dot: '#94a3b8' },
}

const HealthPill: React.FC<PillProps> = ({ label, value, icon, tone, description }) => {
    const c = TONES[tone]
    return (
        <Card
            style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 14,
                padding: '16px 18px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: c.text, display: 'flex' }}>{icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                        {label}
                    </span>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 26, fontWeight: 800, color: c.text, lineHeight: 1.1 }}>
                {value}
            </div>
            {description && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: '#94a3b8' }}>{description}</div>
            )}
        </Card>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export const BusinessHealth: React.FC = () => {
    const { user, token } = useAuth()
    const isOnline = useOnlineStatus()
    const { pendingCount, globalSyncStatus, triggerGlobalSync } = useOfflineSync()

    const tenantId = user?.tenantId
    const role = user?.role ?? ''

    // CASHIER does not see Business Health
    if (role === 'CASHIER') return null
    if (!tenantId) return null

    const [lowStock, setLowStock] = useState<LowStockResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [offlineMode, setOfflineMode] = useState(false)

    const fetchLowStock = async () => {
        setLoading(true)
        setError(null)
        try {
            if (isOnline) {
                // Reuse existing manager-stats endpoint — already returns lowStock
                const data = await apiClient.getManagerDashboardStats(tenantId, token || undefined)
                setLowStock({
                    count: data.lowStock?.count ?? 0,
                    items: data.lowStock?.items ?? [],
                })
                setOfflineMode(false)
            } else {
                // Offline fallback: compute from local IDB products store
                const result = await computeLowStockOffline(tenantId)
                setLowStock(result)
                setOfflineMode(true)
            }
        } catch (err: any) {
            setError(err?.message || 'Unable to load stock data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLowStock()
    }, [isOnline, tenantId])

    // ── Derived values ─────────────────────────────────────────────────────────

    const onlineTone: PillProps['tone'] = isOnline ? 'green' : 'red'
    const onlineLabel = isOnline ? 'Online' : 'Offline'
    const onlineIcon = isOnline
        ? <Wifi size={15} />
        : <WifiOff size={15} />

    const syncTone: PillProps['tone'] =
        globalSyncStatus === 'ERROR' ? 'red'
            : pendingCount > 0 ? 'amber'
                : 'blue'

    const lowStockTone: PillProps['tone'] =
        !lowStock ? 'slate'
            : lowStock.count === 0 ? 'green'
                : lowStock.count <= 3 ? 'amber'
                    : 'red'

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <section aria-label="Business health">
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Business Health
                </h2>
                {offlineMode && (
                    <span style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                        ⚠ Offline — local data only
                    </span>
                )}
            </div>

            {/* 3-column pill grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 14,
                }}
            >
                {/* Pill 1: Online status */}
                <HealthPill
                    label="Connection"
                    value={onlineLabel}
                    icon={onlineIcon}
                    tone={onlineTone}
                    description={isOnline ? 'All systems connected' : 'Working offline — data saved locally'}
                />

                {/* Pill 2: Pending sync */}
                <HealthPill
                    label="Pending Upload"
                    value={pendingCount}
                    icon={<CloudOff size={15} />}
                    tone={syncTone}
                    description={
                        globalSyncStatus === 'ERROR'
                            ? 'Sync error — will retry automatically'
                            : pendingCount === 0
                                ? 'All changes synced'
                                : `${pendingCount} local change${pendingCount > 1 ? 's' : ''} awaiting upload`
                    }
                />

                {/* Pill 3: Low stock */}
                {loading ? (
                    <Card
                        style={{
                            borderRadius: 14,
                            padding: '16px 18px',
                            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.4s infinite',
                            minHeight: 96,
                        }}
                    >
                        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
                    </Card>
                ) : error ? (
                    <Card style={{ borderRadius: 14, padding: '16px 18px', border: '1px solid #fecaca', background: '#fef2f2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626' }}>
                            <AlertTriangle size={14} />
                            <span style={{ fontSize: 12, fontWeight: 600 }}>Stock data unavailable</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>{error}</div>
                    </Card>
                ) : (
                    <HealthPill
                        label="Low Stock"
                        value={lowStock?.count ?? 0}
                        icon={<AlertTriangle size={15} />}
                        tone={lowStockTone}
                        description={
                            (lowStock?.count ?? 0) === 0
                                ? `All products above ${LOW_STOCK_THRESHOLD} units`
                                : `${lowStock!.count} product${lowStock!.count > 1 ? 's' : ''} at or below ${LOW_STOCK_THRESHOLD} units`
                        }
                    />
                )}
            </div>

            {/* Low stock item list — shown only when there are issues */}
            {!loading && !error && lowStock && lowStock.count > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {lowStock.items.map(item => (
                        <span
                            key={item.id}
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#b45309',
                                background: '#fffbeb',
                                border: '1px solid #fde68a',
                                borderRadius: 6,
                                padding: '3px 10px',
                            }}
                        >
                            {item.productName}
                            <span style={{ marginLeft: 5, color: '#ef4444', fontWeight: 700 }}>
                                ({item.stock})
                            </span>
                        </span>
                    ))}
                    {lowStock.count > lowStock.items.length && (
                        <span style={{ fontSize: 12, color: '#94a3b8', padding: '3px 6px' }}>
                            +{lowStock.count - lowStock.items.length} more
                        </span>
                    )}
                </div>
            )}
        </section>
    )
}
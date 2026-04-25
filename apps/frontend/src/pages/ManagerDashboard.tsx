import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Users, Clock, AlertTriangle, DollarSign, Loader2, Package, RefreshCw, TrendingUp, Award } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '../lib/apiClient';
import { DailySummary } from '../components/DailySummary';

interface LowStockItem {
    id: string;
    productName: string;
    stock: number;
}

interface LeaderboardEntry {
    name: string;
    sales: number;
}

interface ManagerStats {
    staffClockedIn: {
        current: number;
        total: number;
    };
    lowStock: {
        count: number;
        items: LowStockItem[];
    };
    currentShiftSales: number;
    staffLeaderboard: LeaderboardEntry[];
}


const initialStats: ManagerStats = {
    staffClockedIn: { current: 0, total: 0 },
    lowStock: { count: 0, items: [] },
    currentShiftSales: 0,
    staffLeaderboard: [],
};

// Helper: Time-based greeting
const getGreeting = (): string => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

// Helper: Nigerian date format
const formatDate = (): string =>
    new Date().toLocaleDateString('en-NG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

// Helper: Time since last refresh
const getTimeSinceRefresh = (date: Date): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
};


export const ManagerDashboard = () => {
    const { user, token } = useAuth();
    const [stats, setStats] = useState<ManagerStats>(initialStats);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const HERO_GOLD = '#D4AF37';

    // Helper for currency formatting
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
    };

    // Calculate staff percentage
    const staffPercentage = stats.staffClockedIn.total > 0
        ? Math.round((stats.staffClockedIn.current / stats.staffClockedIn.total) * 100)
        : 0;

    // Fetch stats function
    const fetchStats = async () => {
        if (!user?.tenantId || !token) {
            setLoading(false);
            return;
        }

        setIsRefreshing(true);
        setError(null);
        try {
            const data: ManagerStats = await apiClient.getManagerDashboardStats(user.tenantId, token);
            setStats(data);
            setLastRefreshed(new Date());
        } catch (err: any) {
            console.error("Error fetching manager stats:", err);
            setError(err.message || 'Failed to fetch operational data.');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    // 3. Data Fetching Effect
    useEffect(() => {
        fetchStats();
    }, [user?.tenantId, token]);

    // --- Loading State with Shimmer Animation ---
    if (loading) {
        return (
            <div className="space-y-8 p-4 md:p-0">
                <div
                    style={{
                        height: 180,
                        borderRadius: 16,
                        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.4s infinite',
                    }}
                />
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 20,
                    }}
                >
                    {[0, 1, 2, 3].map(i => (
                        <div
                            key={i}
                            style={{
                                height: 130,
                                borderRadius: 16,
                                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 1.4s infinite',
                            }}
                        />
                    ))}
                </div>
                <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    padding: '20px 24px',
                    borderRadius: 14,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: 14,
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>⚠️ Error fetching operational data</div>
                <div>{error}</div>
            </div>
        );
    }

    // 4. Main Render
    return (
        <div className="space-y-8 p-4 md:p-0">
            <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

            {/* ── HEADER SECTION ─────────────────────────────────────────────── */}
            <div
                style={{
                    background: `linear-gradient(135deg, #fffbeb 0%, #fef9c3 60%, #fff 100%)`,
                    border: `1px solid ${HERO_GOLD}33`,
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
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#92400e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}
                    >
                        <Clock size={11} />
                        {formatDate()}
                    </div>
                    <h1
                        style={{
                            fontSize: 26,
                            fontWeight: 800,
                            color: '#0f172a',
                            margin: 0,
                            lineHeight: 1.2,
                        }}
                    >
                        {getGreeting()},{' '}
                        <span style={{ color: HERO_GOLD }}>{user?.name || 'Manager'}</span> 👋
                    </h1>
                    <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>
                        Track staff performance, inventory levels, and shift sales in real-time.
                    </p>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 10,
                            fontSize: 11.5,
                            color: '#92400e',
                        }}
                    >
                        <RefreshCw size={11} />
                        Last updated: {getTimeSinceRefresh(lastRefreshed)}
                        <button
                            onClick={fetchStats}
                            disabled={isRefreshing}
                            style={{
                                background: HERO_GOLD + '22',
                                border: `1px solid ${HERO_GOLD}44`,
                                color: '#92400e',
                                borderRadius: 6,
                                padding: '2px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                                marginLeft: 4,
                                opacity: isRefreshing ? 0.6 : 1,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {user?.tenantId && <DailySummary />}

            {/* ── QUICK STATS KPI CARDS ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* 1. Staff Clocked In */}
                <Card
                    className="p-6 rounded-xl shadow-lg transition-all hover:shadow-xl"
                    style={{ borderLeft: `4px solid ${HERO_GOLD}` }}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-500">Staff Clocked In</p>
                        <Users className="w-5 h-5" style={{ color: HERO_GOLD }} />
                    </div>
                    <div className="text-3xl font-bold mt-2 text-gray-900">
                        {stats.staffClockedIn.current} / {stats.staffClockedIn.total}
                    </div>
                    <div
                        style={{
                            marginTop: 8,
                            width: '100%',
                            height: 4,
                            background: '#e5e7eb',
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                width: `${staffPercentage}%`,
                                background: HERO_GOLD,
                                transition: 'width 0.3s ease',
                            }}
                        />
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                        {staffPercentage}% clocked in
                    </p>
                </Card>

                {/* 2. Low Stock Alerts */}
                <Card
                    className="p-6 rounded-xl shadow-lg transition-all hover:shadow-xl"
                    style={{
                        borderLeft: `4px solid ${stats.lowStock.count > 0 ? '#ef4444' : '#10b981'}`,
                    }}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
                        <AlertTriangle
                            className="w-5 h-5"
                            style={{ color: stats.lowStock.count > 0 ? '#ef4444' : '#10b981' }}
                        />
                    </div>
                    <div
                        className="text-3xl font-bold mt-2"
                        style={{ color: stats.lowStock.count > 0 ? '#dc2626' : '#059669' }}
                    >
                        {stats.lowStock.count}
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                        {stats.lowStock.count === 0 ? '✓ All stock levels healthy' : 'items need restocking'}
                    </p>
                </Card>

                {/* 3. Current Shift Sales */}
                <Card
                    className="p-6 rounded-xl shadow-lg transition-all hover:shadow-xl md:col-span-2"
                    style={{ borderLeft: `4px solid #3b82f6` }}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-500">Current Shift Sales (Active Cashiers)</p>
                        <DollarSign className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="text-4xl font-extrabold mt-2 text-blue-600">
                        {formatCurrency(stats.currentShiftSales)}
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TrendingUp size={14} className="text-blue-500" />
                        Shift in progress
                    </p>
                </Card>
            </div>

            {/* ── STAFF PERFORMANCE LEADERBOARD ─────────────────────────────── */}
            <Card className="p-6 rounded-2xl shadow-xl">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 className="text-xl font-bold text-gray-800">
                        <Award style={{ display: 'inline', marginRight: 8, color: HERO_GOLD }} size={24} />
                        Staff Performance Leaderboard
                    </h2>
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>Active Shifts</span>
                </div>

                {stats.staffLeaderboard.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">No active sales recorded yet in any shift.</div>
                ) : (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto">
                        {stats.staffLeaderboard.map((entry, index) => {
                            const getMedalColor = () => {
                                if (index === 0) return HERO_GOLD;
                                if (index === 1) return '#a0aec0';
                                if (index === 2) return '#d97706';
                                return '#9ca3af';
                            };

                            const getMedalIcon = () => {
                                if (index === 0) return '🥇';
                                if (index === 1) return '🥈';
                                if (index === 2) return '🥉';
                                return index + 1;
                            };

                            return (
                                <div
                                    key={entry.name}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: index === 0 ? `${HERO_GOLD}11` : '#f9fafb',
                                        border: index === 0 ? `1px solid ${HERO_GOLD}33` : '1px solid #e5e7eb',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                fontSize: index < 3 ? 18 : 14,
                                                background: index < 3 ? 'transparent' : getMedalColor(),
                                                color: index < 3 ? 'inherit' : '#fff',
                                            }}
                                        >
                                            {getMedalIcon()}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 600, color: '#1f2937', marginBottom: 2 }}>{entry.name}</p>
                                            <p style={{ fontSize: 12, color: '#6b7280' }}>
                                                {index === 0 && '⚡ Top performer'}
                                                {index === 1 && '📈 Runner-up'}
                                                {index === 2 && '🎯 Third place'}
                                                {index > 2 && 'Contributor'}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p
                                            className="text-2xl font-extrabold"
                                            style={{ color: index === 0 ? HERO_GOLD : '#1f2937' }}
                                        >
                                            {formatCurrency(entry.sales)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* ── LOW STOCK DETAILED LIST ────────────────────────────────────── */}
            {stats.lowStock.count > 0 && (
                <Card className="p-6 rounded-2xl shadow-xl">
                    <h2 className="text-xl font-bold mb-6 flex items-center" style={{ color: '#dc2626' }}>
                        <Package className="w-6 h-6 mr-3" style={{ color: '#dc2626' }} />
                        {stats.lowStock.count} Items Needing Restock
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {stats.lowStock.items.map((item, idx) => (
                            <div
                                key={item.id}
                                style={{
                                    padding: 12,
                                    background: '#fef2f2',
                                    border: '1px solid #fee2e2',
                                    borderLeft: `4px solid ${idx === 0 ? '#dc2626' : '#f87171'}`,
                                    borderRadius: 8,
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <p className="font-semibold text-gray-800 truncate">{item.productName}</p>
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Stock: {item.stock}</span>
                                    {idx === 0 && <span style={{ fontSize: 10, color: '#fff', background: '#dc2626', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>URGENT</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};
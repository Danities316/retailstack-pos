import React, { useEffect, useState } from 'react'
import { SalesSummary } from '../components/SalesSummary'
import { SalesChart } from '../components/SalesChart'
import { QuickStats } from '../components/QuickStats'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PlusIcon, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '../lib/apiClient'

export const OwnerDashboard = () => {

    const navigate = useNavigate()
    const { user, token } = useAuth()
    const [quickStats, setQuickStats] = useState<any>(null)
    const [loadingStats, setLoadingStats] = useState(true)
    const [errorStats, setErrorStats] = useState<string | null>(null)

    // ... (useAuth, useState, useEffect for fetching stats remain the same)
    // ... (mock data for topProducts remains the same)
    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.tenantId || !token) return
            setLoadingStats(true)
            setErrorStats(null)
            try {
                const data = await apiClient.getDashboardStats(user.tenantId, token)
                setQuickStats(data)
            } catch (err: any) {
                setErrorStats(err.message || 'Error fetching stats')
            } finally {
                setLoadingStats(false)
            }
        }
        fetchStats()
    }, [user?.tenantId, token])

    const topProducts = [
        {
            name: 'Coffee Mug',
            sales: 12,
            revenue: '₦144.00',
        },
        {
            name: 'T-Shirt (Black)',
            sales: 8,
            revenue: '₦159.92',
        },
        {
            name: 'Wireless Earbuds',
            sales: 5,
            revenue: '₦249.95',
        },
    ]

    const HERO_GOLD = '#D4AF37';

    // ... (fetchStats logic)

    return (
        <div className="space-y-8 p-4 md:p-0">
            {/* Dashboard Header & CTA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-100">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">
                        Welcome, <span style={{ color: HERO_GOLD }}>{user?.name || 'Owner'}!</span>
                    </h1>
                    <p className="text-base text-gray-500 mt-1">
                        Comprehensive overview of your entire retail operation.
                    </p>
                </div>

                {/* Quick Action Buttons (Owner focus is typically on big picture actions) */}
                <div className="flex space-x-3 mt-4 md:mt-0">
                    <Button
                        style={{ backgroundColor: HERO_GOLD }}
                        className="flex items-center hover:bg-[#c2a032] text-white rounded-xl shadow-md transition-colors"
                        onClick={() => navigate('/dashboard/reports')}
                    >
                        <ArrowRight size={16} className="mr-1" /> View Financial Reports
                    </Button>
                </div>
            </div>

            {/* Quick Stats, Sales Chart, Top Products, Sales Summary - ALL REMAIN HERE */}
            {/* ... (Existing QuickStats, SalesChart, TopProducts, SalesSummary components) ... */}


            {/* Quick Stats Loader/Error */}
            {loadingStats ? (
                <div className="h-24 flex items-center justify-center text-gray-500 bg-white rounded-xl shadow-md">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading stats...
                </div>
            ) : errorStats ? (
                <div className="h-24 flex items-center justify-center text-red-500 bg-red-50 border border-red-200 rounded-xl shadow-md">{errorStats}</div>
            ) : quickStats ? (
                <QuickStats stats={quickStats} />
            ) : null}

            {/* Charts and Top Products Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Sales Chart (2/3 width) */}
                <div className="lg:col-span-2">
                    {user?.tenantId && (
                        <SalesChart tenantId={user.tenantId} token={token || undefined} />
                    )}
                </div>

                {/* Top Selling Products Card (1/3 width) - Refactored for better UX */}
                <div className="lg:col-span-1">
                    <Card className="rounded-2xl shadow-xl border border-gray-100 h-full"> {/* Enhanced Card style */}
                        <div className="p-6">

                            {/* Header */}
                            <div className="font-extrabold text-xl text-gray-900 mb-4 flex items-center justify-between">
                                <span>Top Selling Products</span>
                                <ShoppingBag className="w-5 h-5" style={{ color: HERO_GOLD }} /> {/* Brand color icon */}
                            </div>
                            <div className="border-b border-gray-200 -mx-6 mb-2"></div>

                            {/* Product List */}
                            {topProducts.map((product, index) => (
                                <div
                                    key={index}
                                    className={`
                                flex justify-between items-center
                                ${index !== topProducts.length - 1 ? 'border-b border-gray-100' : ''}
                                py-4 transition hover:bg-gray-50 -mx-6 px-6
                              `}
                                >
                                    <div className='flex items-center'>
                                        <span className='font-bold text-lg mr-3 text-gray-400'>{index + 1}.</span> {/* Rank */}
                                        <div>
                                            <div className="font-semibold text-gray-800 text-base">{product.name}</div>
                                            <div className="text-sm text-gray-500">{product.sales} units sold</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="font-bold text-gray-900 text-lg">{product.revenue}</span>
                                    </div>
                                </div>
                            ))}

                            {/* View All Button */}
                            <div className="border-t border-gray-200 mt-2 pt-4 text-center -mx-6 px-6">
                                <button
                                    className="inline-flex items-center gap-2 font-semibold hover:underline focus:outline-none transition-colors"
                                    style={{ color: HERO_GOLD }} // Applied brand color
                                    onClick={() => navigate('/dashboard/products')}
                                >
                                    View All Products
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Sales Summary */}
            {user?.tenantId && (
                <SalesSummary tenantId={user.tenantId} token={token || undefined} />
            )}
        </div>
    )
}
import React, { useEffect, useState } from 'react'
import { SalesSummary } from '../components/SalesSummary'
import { SalesChart } from '../components/SalesChart'
import { QuickStats } from '../components/QuickStats'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PlusIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '../lib/apiClient'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [quickStats, setQuickStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [errorStats, setErrorStats] = useState<string | null>(null)

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
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500">
            Welcome back! Here's what's happening today.
          </p>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0">
          <Button variant="default" className="md:hidden flex items-center">
            <PlusIcon size={16} className="mr-1" /> New Sale
          </Button>
          <Button variant="outline" className="md:hidden">
            Add Product
          </Button>
        </div>
      </div>
      {loadingStats ? (
        <div className="h-24 flex items-center justify-center text-gray-500">Loading stats...</div>
      ) : errorStats ? (
        <div className="h-24 flex items-center justify-center text-red-500">{errorStats}</div>
      ) : quickStats ? (
        <QuickStats stats={quickStats} />
      ) : null}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {user?.tenantId && (
            <SalesChart tenantId={user.tenantId} token={token || undefined} />
          )}
        </div>
        <div className="lg:col-span-1">
          <Card>
            <div className="p-6">
            <div className="font-semibold text-lg text-blue-600 mb-4 text-center ">Top Selling Products</div>
            <div className="border-b border-gray-200 -mx-6 mb-2"></div>
              {topProducts.map((product, index) => (
                <div
                  key={index}
                  className={`
                    flex justify-between
                    ${index !== topProducts.length - 1 ? 'border-b border-gray-200' : ''}
                    py-4
                  `}
                >
                  <div>
                    <div className="font-semibold text-gray-800 text-base">{product.name}</div>
                    <div className="text-sm text-gray-500">{product.sales} units sold</div>
                  </div>
                  <div className="flex items-center h-full">
                    <span className="font-semibold text-gray-800 text-lg">{product.revenue}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-200 mt-2 pt-4 text-center">
                <button
                  className="text-blue-600 font-semibold hover:underline focus:outline-none"
                  onClick={() => navigate('/dashboard/products')}
                >
                  View All Products
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {user?.tenantId && (
        <SalesSummary tenantId={user.tenantId} token={token || undefined} />
      )}
    </div>
  )
}

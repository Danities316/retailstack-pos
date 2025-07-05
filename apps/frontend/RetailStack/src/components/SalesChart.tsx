import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { apiClient } from '../lib/apiClient'

interface SalesChartProps {
  tenantId: string
  token?: string
}

export const SalesChart = ({ tenantId, token }: SalesChartProps) => {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [noOfflineData, setNoOfflineData] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    setIsOffline(false)
    setNoOfflineData(false)
    apiClient.getSalesChartData(tenantId, timeRange, token)
      .then((result) => {
        setData(result)
        if (!navigator.onLine) {
          setIsOffline(true)
          if (!result || result.length === 0) setNoOfflineData(true)
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load sales chart')
        if (!navigator.onLine) setIsOffline(true)
      })
      .finally(() => setLoading(false))
  }, [tenantId, token, timeRange])

  const handleRangeChange = (range: 'today' | 'week' | 'month') => {
    setTimeRange(range)
  }

  return (
    <Card title="Sales Performance" className="h-full">
      <div className="flex justify-between items-center mb-6 ml-4">
        <div className="flex items-center gap-2">
        <h3 className="text-lg font-medium text-gray-800">Revenue Overview</h3>
          {isOffline && (
            <span className="ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800 font-semibold">Offline</span>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handleRangeChange('today')}
            className={`px-3 py-1 text-sm rounded-md ${timeRange === 'today' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Today
          </button>
          <button
            onClick={() => handleRangeChange('week')}
            className={`px-3 py-1 text-sm rounded-md ${timeRange === 'week' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            This Week
          </button>
          <button
            onClick={() => handleRangeChange('month')}
            className={`px-3 py-1 text-sm rounded-md ${timeRange === 'month' ? 'bg-blue-100 text-blue-700 mr-2' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            This Month
          </button>
        </div>
      </div>
      <div className="h-72">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">Loading chart...</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : noOfflineData ? (
          <div className="flex items-center justify-center h-full text-yellow-600">No offline data available. Please connect to the internet at least once.</div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
              data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
            <Tooltip />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="sales"
              name="Sales (₦)"
              fill="#4f46e5"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="transactions"
              name="Transactions"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

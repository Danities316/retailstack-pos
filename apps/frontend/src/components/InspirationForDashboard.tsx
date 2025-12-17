import React from 'react'
import { SalesSummary } from './SalesSummary'
import { SalesChart } from './SalesChart'
import { QuickStats } from './QuickStats'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
// import { Card } from '../common/Card'
import { PlusIcon } from 'lucide-react'
export const Dashboard = () => {
  // Sample data - in a real app this would come from API/state
  const todayStats = {
    totalSales: '$2,854.50',
    transactions: 32,
    avgSale: '$89.20',
    compareYesterday: '+12%',
  }
  const topProducts = [
    {
      name: 'Coffee Mug',
      sales: 12,
      revenue: '$144.00',
    },
    {
      name: 'T-Shirt (Black)',
      sales: 8,
      revenue: '$159.92',
    },
    {
      name: 'Wireless Earbuds',
      sales: 5,
      revenue: '$249.95',
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
      <QuickStats stats={todayStats} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <div className="lg:col-span-1">
          <Card title="Top Selling Products">
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <h4 className="font-medium text-gray-800">
                      {product.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {product.sales} units sold
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-800">
                      {product.revenue}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <Button
                variant="ghost"
                className="text-blue-600 w-full justify-center"
              >
                View All Products
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <SalesSummary />
    </div>
  )
}

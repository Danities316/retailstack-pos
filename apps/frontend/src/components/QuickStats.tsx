import React from 'react'
import {
  HandCoins,
  ShoppingBagIcon,
  TrendingUpIcon,
  PercentIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
interface StatsProps {
  stats: {
    totalSales: string
    transactions: number
    avgSale: string
    compareYesterday: string
  }
}
export const QuickStats = ({ stats }: StatsProps) => {
  const statItems = [
    {
      title: 'Total Sales',
      value: stats.totalSales,
      icon: <HandCoins className="h-5 w-5 text-blue-500" />,
      change: stats.compareYesterday,
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Transactions',
      value: stats.transactions,
      icon: <ShoppingBagIcon className="h-5 w-5 text-green-500" />,
      change: '+5%',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Average Sale',
      value: stats.avgSale,
      icon: <TrendingUpIcon className="h-5 w-5 text-purple-500" />,
      change: '+2%',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Tax Collected',
      value: '₦231.65',
      icon: <PercentIcon className="h-5 w-5 text-orange-500" />,
      change: '+8%',
      bgColor: 'bg-orange-50',
    },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <Card key={index} className="border-none">
          <div className="flex items-start">
            <div className={`p-3 ml-2 rounded-lg ${item.bgColor} mr-4`}>
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{item.title}</p>
              <h3 className="text-xl font-bold text-gray-800">{item.value}</h3>
              <p className="text-sm text-green-600">
                {item.change} from yesterday
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

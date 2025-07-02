import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiClient } from '../lib/apiClient'

interface SalesSummaryProps {
  tenantId: string
  token?: string
}

export const SalesSummary = ({ tenantId, token }: SalesSummaryProps) => {
  const [transactions, setTransactions] = useState<any[]>([])
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
    apiClient.getRecentSalesData(tenantId, token)
      .then((result) => {
        setTransactions(result)
        if (!navigator.onLine) {
          setIsOffline(true)
          if (!result || result.length === 0) setNoOfflineData(true)
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load recent sales')
        if (!navigator.onLine) setIsOffline(true)
      })
      .finally(() => setLoading(false))
  }, [tenantId, token])

  return (
    <Card title="Today's Transactions" className="overflow-hidden">
      <div className="flex items-center gap-2 px-6 pt-4">
        {isOffline && (
          <span className="ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800 font-semibold">Offline</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Transaction
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Customer
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Items
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Total
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Time
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="text-center py-8 text-red-500">{error}</td></tr>
            ) : noOfflineData ? (
              <tr><td colSpan={7} className="text-center py-8 text-yellow-600">No offline data available. Please connect to the internet at least once.</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No recent transactions</td></tr>
            ) : (
              transactions.map((transaction, index) => (
                <tr key={transaction.id || index} className="hover:bg-gray-50">
<<<<<<< HEAD
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {transaction.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {transaction.customer}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {transaction.items}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ₦{Number(transaction.total).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${transaction.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                  >
                    {transaction.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button variant="ghost" size="sm" className="text-blue-600">
                    Details
                  </Button>
                </td>
              </tr>
=======
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {transaction.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.customer}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.items}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ₦{Number(transaction.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${transaction.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                    >
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button variant="ghost" size="sm" className="text-blue-600">
                      Details
                    </Button>
                  </td>
                </tr>
>>>>>>> f3fdb7e (Initial commit)
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500 ml-4">
          Showing {transactions.length} of 5 transactions
        </div>
        <Button variant="outline" size="sm" className='mr-6'>
          View All Transactions
        </Button>
      </div>
    </Card>
  )
}

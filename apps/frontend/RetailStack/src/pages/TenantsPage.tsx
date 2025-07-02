import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface Tenant {
  id: string
  name: string
  phoneNumber: string
  createdAt?: string
  users?: { id: string }[]
}

export const TenantsPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      setError('Access denied: Only SUPER_ADMIN can view tenants.')
      setLoading(false)
      return
    }
    const fetchTenants = async () => {
      try {
        setLoading(true)
        const data = await apiClient.request('/superadmin/tenants')
        setTenants(data)
      } catch (err: any) {
        setError('Failed to load tenants')
      } finally {
        setLoading(false)
      }
    }
    fetchTenants()
  }, [user])

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.phoneNumber.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p>Loading tenants...</p></div>
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-blue-600 font-semibold">Tenants</h1>
          <p className="text-gray-600">All registered tenants in the system</p>
        </div>
      </div>
      <div className="mb-4">
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTenants.map(tenant => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{tenant.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{tenant.phoneNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap">{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{tenant.users ? tenant.users.length : '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/dashboard/tenants/${tenant.id}`)}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredTenants.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No tenants found</p>
        </div>
      )}
    </div>
  )
}

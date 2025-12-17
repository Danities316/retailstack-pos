import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface TenantUser {
  id: string
  email: string
  role: string
  phoneNumber: string
}

interface Tenant {
  id: string
  name: string
  phoneNumber: string
  createdAt?: string
  users: TenantUser[]
}

export const TenantDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      setError('Access denied: Only SUPER_ADMIN can view tenant details.')
      setLoading(false)
      return
    }
    const fetchTenant = async () => {
      try {
        setLoading(true)
        const data = await apiClient.request(`/superadmin/tenants/${id}`)
        setTenant(data)
      } catch (err: any) {
        setError('Failed to load tenant details')
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchTenant()
  }, [id, user])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p>Loading tenant details...</p></div>
  }
  if (error || !tenant) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error || 'Tenant not found'}</p>
          <Button onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tenant Details</h1>
          <p className="text-gray-600">Tenant ID: {tenant.id}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="space-y-4">
          <div>
            <span className="text-gray-600">Name:</span>
            <span className="ml-2 font-medium">{tenant.name}</span>
          </div>
          <div>
            <span className="text-gray-600">Phone Number:</span>
            <span className="ml-2 font-medium">{tenant.phoneNumber}</span>
          </div>
          {tenant.createdAt && (
            <div>
              <span className="text-gray-600">Created At:</span>
              <span className="ml-2 font-medium">{new Date(tenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Users</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tenant.users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{u.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">{u.role}</td>
                <td className="px-6 py-4 whitespace-nowrap">{u.phoneNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
} 
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface User {
  id: string
  name: string
  email: string
  role: string
  phoneNumber: string
  createdAt: string
  isActive: boolean
}

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true)
        const data = await apiClient.request(`/users/${id}`)
        setUser(data)
      } catch (err: any) {
        setError('Failed to load user details')
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchUser()
  }, [id])

  const handleDelete = async () => {
    if (!user || !id) return
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
    setDeleting(true)
    try {
      await apiClient.request(`/users/${id}`, { method: 'DELETE' })
      navigate('/dashboard/users')
    } catch (err: any) {
      setError('Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p>Loading user details...</p></div>
  }
  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error || 'User not found'}</p>
          <Button onClick={() => navigate('/dashboard/users')}>Back to Users</Button>
        </div>
      </div>
    )
  }

  const canDelete = (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'OWNER') && currentUser?.id !== user.id

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-blue-600 font-semibold">User Details</h1>
          <p className="text-gray-600">User ID: {user.id}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard/users')}>Back to Users</Button>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <span className="text-gray-600">Name:</span>
            <span className="ml-2 font-medium">{user.name}</span>
          </div>
          <div>
            <span className="text-gray-600">Email:</span>
            <span className="ml-2 font-medium">{user.email}</span>
          </div>
          <div>
            <span className="text-gray-600">Role:</span>
            <span className="ml-2 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{user.role}</span>
          </div>
          <div>
            <span className="text-gray-600">Phone Number:</span>
            <span className="ml-2 font-medium">{user.phoneNumber}</span>
          </div>
          <div>
            <span className="text-gray-600">Joined:</span>
            <span className="ml-2 font-medium">{new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        {canDelete && (
          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              className="text-red-600"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 
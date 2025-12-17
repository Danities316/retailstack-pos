import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

interface User {
  id: string
  email: string
  name: string
  role: string
  phoneNumber: string
  createdAt: string
  isActive: boolean
}

export const UsersPage = () => {
  const navigate = useNavigate()
  const { user: currentUser, token } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true)
        // Note: We'll need to create a GET /users endpoint in the backend
        // For now, this is a placeholder
        const usersData = await apiClient.request('/users')
        setUsers(usersData.users)
      } catch (error) {
        setError('Failed to load users')
        console.error('Error loading users:', error)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadUsers()
    }
  }, [token])

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800'
      case 'OWNER':
        return 'bg-red-100 text-red-800'
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800'
      case 'CASHIER':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading users...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-blue-600 font-semibold">Users</h1>
          <p className="text-gray-600">Manage users in your organization</p>
        </div>
        {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER') && (
          <Link to="/dashboard/users/invite">
            <Button className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150">Invite User</Button>
          </Link>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.phoneNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full bg-green-100 text-green-800`}>
                  </span>
                </td>
                {/* <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td> */}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/dashboard/users/${user.id}`)}
                    >
                      View
                    </Button>
                    {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'OWNER') && 
                     user.id !== currentUser?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => {
                          // TODO: Implement user deletion
                          alert('User deletion not implemented yet')
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No users found</p>
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER') && (
            <Link to="/dashboard/users/invite">
              <Button>Invite Your First User</Button>
            </Link>
          )}
        </div>
      )}

      {/* User Statistics */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">User Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Active Users</p>
            <p className="text-2xl font-bold">{users.filter(u => u.isActive).length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Managers</p>
            <p className="text-2xl font-bold">{users.filter(u => u.role === 'MANAGER').length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Staff</p>
            <p className="text-2xl font-bold">{users.filter(u => u.role === 'CASHIER').length}</p>
          </div>
        </div>
      </div>
    </div>
  )
} 
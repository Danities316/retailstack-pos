import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/lib/apiClient'

export const InviteUserPage = () => {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'CASHIER',
    phoneNumber: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    console.log("See submit details: ", JSON.stringify(formData))

    if (!formData.email || !formData.name || !formData.phoneNumber) {
      setError('All fields are required')
      setLoading(false)
      return
    }

    try {
      await apiClient.request('/users/invite', {
        method: 'POST',
        body: JSON.stringify(formData)
      })
      
      setSuccess('User invitation sent successfully!')
      setFormData({
        email: '',
        name: '',
        role: '',
        phoneNumber: ''
      })
      
      setTimeout(() => navigate('/dashboard/users'), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const getAvailableRoles = () => {
    const roles = [
      { value: 'CASHIER', label: 'Cashier' },
      { value: 'MANAGER', label: 'Manager' }
    ]

    // Only SUPER_ADMIN can create OWNER roles
    if (currentUser?.role === 'SUPER_ADMIN') {
      roles.push({ value: 'OWNER', label: 'Owner' })
    }

    return roles
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-blue-600 font-semibold">Invite User</h1>
          <p className="text-gray-600">Send an invitation to join your organization</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard/users')}>
          Back to Users
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter email address"
              required
            />
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <Input
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              placeholder="Enter phone number"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Role *
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {getAvailableRoles().map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Select the appropriate role for this user
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md transition-colors duration-150">
              {loading ? 'Sending Invitation...' : 'Send Invitation'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/dashboard/users')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {/* Information Section */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">How It Works</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• An invitation email will be sent to the user's email address</li>
          <li>• The user will receive a secure link to set up their account</li>
          <li>• They'll be able to create their password and complete their profile</li>
          <li>• The invitation expires after 24 hours for security</li>
        </ul>
      </div>

      {/* Role Information */}
      <div className="mt-4 bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-yellow-800">Role Permissions</h3>
        <div className="text-sm text-yellow-700 space-y-2">
          <div>
            <strong>Cashier:</strong> Can view products, create sales, and manage basic operations
          </div>
          <div>
            <strong>Manager:</strong> Can manage products, categories, users, and view reports
          </div>
          {currentUser?.role === 'SUPER_ADMIN' && (
            <div>
              <strong>Owner:</strong> Full access to all features including tenant settings
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
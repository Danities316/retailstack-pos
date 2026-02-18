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
    phoneNumber: '',
    notificationMethod: 'email' // 'email' | 'sms' | 'both'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    console.log("Send invitation with details: ", JSON.stringify(formData))

    if (!formData.email || !formData.name || !formData.phoneNumber) {
      setError('Email, name, and phone number are required')
      setLoading(false)
      return
    }

    if (!formData.notificationMethod) {
      setError('Please select a notification method')
      setLoading(false)
      return
    }

    try {
      const response = await apiClient.request('/users/invite', {
        method: 'POST',
        body: JSON.stringify(formData)
      })

      setSuccess(`User invitation sent successfully via ${formData.notificationMethod}!`)
      setFormData({
        email: '',
        name: '',
        role: 'CASHIER',
        phoneNumber: '',
        notificationMethod: 'email'
      })

      setTimeout(() => navigate('/dashboard/users'), 2500)
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

          {/* Notification Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How should we send the invitation? *
            </label>
            <div className="space-y-3">
              <div className="flex items-center border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleInputChange('notificationMethod', 'email')}>
                <input
                  type="radio"
                  id="method-email"
                  name="notificationMethod"
                  value="email"
                  checked={formData.notificationMethod === 'email'}
                  onChange={(e) => handleInputChange('notificationMethod', e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="method-email" className="ml-3 cursor-pointer flex-1">
                  <div className="font-medium text-gray-900">📧 Email Invitation</div>
                  <p className="text-sm text-gray-600">Send setup link via email (user clicks link to set password)</p>
                </label>
              </div>

              <div className="flex items-center border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleInputChange('notificationMethod', 'sms')}>
                <input
                  type="radio"
                  id="method-sms"
                  name="notificationMethod"
                  value="sms"
                  checked={formData.notificationMethod === 'sms'}
                  onChange={(e) => handleInputChange('notificationMethod', e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="method-sms" className="ml-3 cursor-pointer flex-1">
                  <div className="font-medium text-gray-900">📱 SMS with Code</div>
                  <p className="text-sm text-gray-600">Send 6-digit setup code via SMS (user enters code on setup page)</p>
                </label>
              </div>

              <div className="flex items-center border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleInputChange('notificationMethod', 'both')}>
                <input
                  type="radio"
                  id="method-both"
                  name="notificationMethod"
                  value="both"
                  checked={formData.notificationMethod === 'both'}
                  onChange={(e) => handleInputChange('notificationMethod', e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="method-both" className="ml-3 cursor-pointer flex-1">
                  <div className="font-medium text-gray-900">📧📱 Both Methods</div>
                  <p className="text-sm text-gray-600">Send both email link and SMS code for maximum flexibility</p>
                </label>
              </div>
            </div>
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
          <li>• <strong>Email:</strong> User receives link to set up password (recommended for managers)</li>
          <li>• <strong>SMS:</strong> User receives 6-digit code to complete setup (recommended for remote staff)</li>
          <li>• <strong>Both:</strong> Send both email and SMS for users who prefer flexibility</li>
          <li>• All invitations expire after 24 hours for security</li>
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
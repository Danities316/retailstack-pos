import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/apiClient'

interface UserInfo {
  id: string
  email: string
  name: string
  role: string
}

export const UserSetupPage = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Verify token and get user info
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Invalid setup link')
        setLoading(false)
        return
      }

      try {
        const response = await apiClient.request(`/auth/setup-account/${token}`)
        setUserInfo(response.user)
      } catch (error) {
        setError('Invalid or expired setup link')
        console.error('Error verifying token:', error)
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    if (!password || !confirmPassword) {
      setError('Please fill in all fields')
      setSaving(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setSaving(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      setSaving(false)
      return
    }

    try {
      await apiClient.request('/auth/setup-account', {
        method: 'POST',
        body: {
          token,
          password
        }
      })

      setSuccess('Account setup completed successfully!')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to setup account')
    } finally {
      setSaving(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Administrator'
      case 'OWNER':
        return 'Owner'
      case 'MANAGER':
        return 'Manager'
      case 'CASHIER':
        return 'Cashier'
      default:
        return role
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Verifying Invitation</h2>
            <p className="mt-2 text-gray-600">Please wait while we verify your setup link...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Invalid Link</h2>
            <p className="mt-2 text-red-600">{error}</p>
            <div className="mt-4">
              <Button onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Account Setup
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Welcome to the team! Please set up your password to complete your account.
          </p>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {userInfo && (
            <div className="mb-6 bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Account Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-blue-800">Name:</span> {userInfo.name}
                </div>
                <div>
                  <span className="font-medium text-blue-800">Email:</span> {userInfo.email}
                </div>
                <div>
                  <span className="font-medium text-blue-800">Role:</span> {getRoleDisplayName(userInfo.role)}
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="mt-1"
              />
            </div>

            <div>
              <Button
                type="submit"
                disabled={saving || !password || !confirmPassword}
                className="w-full"
              >
                {saving ? 'Setting Up Account...' : 'Complete Setup'}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Password Requirements</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-600 space-y-1">
              <p>• Password must be at least 8 characters long</p>
              <p>• Use a combination of letters, numbers, and symbols for better security</p>
              <p>• This link will expire after 24 hours for security</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Query parameter token support (from email link)
  const tokenFromQuery = searchParams.get('token') || token

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [setupMethod, setSetupMethod] = useState<'token' | 'code' | null>(null) // 'token' for email, 'code' for SMS
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('') // For SMS 6-digit code
  const [email, setEmail] = useState('') // For SMS code verification
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Verify token and get user info
  useEffect(() => {
    const verifyToken = async () => {
      if (tokenFromQuery) {
        // User came from email link with token
        try {
          const response = await apiClient.request(`/auth/setup-account/${tokenFromQuery}`)
          setUserInfo(response.user)
          setSetupMethod('token')
        } catch (error) {
          setError('Invalid or expired setup link')
          console.error('Error verifying token:', error)
        } finally {
          setLoading(false)
        }
      } else {
        // User is setting up via SMS code - no verification yet, just show form
        setSetupMethod('code')
        setLoading(false)
      }
    }

    verifyToken()
  }, [tokenFromQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      if (setupMethod === 'token') {
        // Email-based setup with token
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

        await apiClient.request('/auth/setup-account', {
          method: 'POST',
          body: {
            token: tokenFromQuery,
            password
          }
        })

        setSuccess('Account setup completed successfully!')
        setTimeout(() => navigate('/login'), 2000)
      } else if (setupMethod === 'code') {
        // SMS-based setup with 6-digit code
        if (!email || !verificationCode || !password || !confirmPassword) {
          setError('Please fill in all fields')
          setSaving(false)
          return
        }

        if (verificationCode.length !== 6 || !/^\d+$/.test(verificationCode)) {
          setError('Setup code must be exactly 6 digits')
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

        // Send verification code + email + password to backend
        // Note: Backend will find user by email, verify code, and set password
        await apiClient.request('/auth/setup-account-sms', {
          method: 'POST',
          body: {
            email,
            code: verificationCode,
            password
          }
        })

        setSuccess('Account setup completed successfully!')
        setTimeout(() => navigate('/login'), 2000)
      }
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

  if (error && !userInfo && setupMethod === 'token') {
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

          {/* EMAIL/TOKEN-BASED SETUP */}
          {setupMethod === 'token' && userInfo && (
            <>
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
            </>
          )}

          {/* SMS/CODE-BASED SETUP */}
          {setupMethod === 'code' && (
            <>
              <div className="mb-6 bg-amber-50 p-4 rounded-lg border border-amber-200">
                <h3 className="text-lg font-semibold text-amber-900 mb-2">📱 SMS Verification</h3>
                <p className="text-sm text-amber-800">
                  Enter the 6-digit code we sent to your phone to verify your account.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address *
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter the email address associated with your invitation
                  </p>
                </div>

                <div>
                  <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700">
                    Setup Code (6 digits) *
                  </label>
                  <Input
                    id="verificationCode"
                    name="verificationCode"
                    type="text"
                    maxLength={6}
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="mt-1 text-center text-2xl font-bold tracking-widest"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter the 6-digit code from your SMS
                  </p>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Create Password *
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
                    disabled={saving || !email || !verificationCode || !password || !confirmPassword}
                    className="w-full"
                  >
                    {saving ? 'Setting Up Account...' : 'Complete Setup'}
                  </Button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Didn't receive a code? <br />
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Contact your manager for a new invitation
                  </button>
                </p>
              </div>
            </>
          )}

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
              <p>• Setup links and codes expire after 24 hours for security</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
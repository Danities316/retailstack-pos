import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

const HERO_GOLD = '#D4AF37'

export const EmailVerificationPage = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error')
        setMessage('No verification token provided.')
        return
      }

      try {
        const response = await apiClient.request(`/auth/verify-email/${token}`, {
          method: 'GET',
        })

        if (response.error) {
          throw new Error(response.error)
        }

        setStatus('success')
        setMessage('✓ Your email has been verified successfully!')
        setTimeout(() => navigate('/login'), 3000)
      } catch (err: any) {
        setStatus('error')
        setMessage(err.message || 'Failed to verify email. The link may have expired.')
      }
    }

    verifyEmail()
  }, [token, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin" style={{ color: HERO_GOLD }} />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Email</h1>
              <p className="text-gray-600">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="text-sm text-gray-500">Redirecting to login in 3 seconds...</div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <a
                  href="/login"
                  className="inline-block px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
                  style={{ backgroundColor: HERO_GOLD }}
                >
                  Go to Login
                </a>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                <div>
                  <a
                    href="/onboard"
                    className="inline-block px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: HERO_GOLD }}
                  >
                    Try Again
                  </a>
                </div>
                <div>
                  <a href="/login" className="text-sm text-gray-600 hover:underline">
                    Already have an account? Log in
                  </a>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p className="flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Check your email for the verification link
          </p>
        </div>
      </div>
    </div>
  )
}

export default EmailVerificationPage

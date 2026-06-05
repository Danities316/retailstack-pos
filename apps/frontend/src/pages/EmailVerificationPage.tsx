import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, CheckCircle, XCircle, Loader2, Send, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

const HERO_GOLD = '#D4AF37'

export const EmailVerificationPage = () => {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)
  const verificationAttemptedRef = useRef(false)

  // Get email from URL params if provided (from signup redirect)
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) setEmail(decodeURIComponent(emailParam))

    // Get dev verification link if in development mode
    const devLinkParam = searchParams.get('devLink')
    if (devLinkParam) setDevLink(decodeURIComponent(devLinkParam))
  }, [searchParams])

  const handleVerifyEmail = async () => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided.')
      setErrorCode('NO_TOKEN')
      return
    }

    try {
      console.log(`[FRONTEND] Starting email verification with token: ${token.substring(0, 8)}...`)

      const response = await apiClient.request(`/auth/verify-email/${token}`, {
        method: 'GET',
      })

      console.log(`[FRONTEND] Verification response:`, response)

      // Check if response indicates success (either success field or no error field)
      if (response.success === true || (response.message && !response.error)) {
        // Store verified email for potential future use
        if (response.user?.email) {
          setEmail(response.user.email)
          console.log(`[FRONTEND] ✓ Email verified: ${response.user.email}`)
        }

        setStatus('success')
        setMessage('✓ Your email has been verified successfully!')
        console.log(`[FRONTEND] Email verified, user can now proceed to login`)
        return
      }

      // If we get here, response has an error
      if (response.error) {
        console.log(`[FRONTEND] Verification error code: ${response.code}`)

        // Handle different error codes
        if (response.code === 'EXPIRED_TOKEN' || response.code === 'INVALID_OR_EXPIRED_TOKEN') {
          setStatus('expired')
          setMessage('This verification link has expired. A new link must be requested.')
          setErrorCode('EXPIRED_TOKEN')
        } else if (response.code === 'INVALID_TOKEN') {
          setStatus('error')
          setMessage('The verification link is invalid. Please request a new verification email.')
          setErrorCode('INVALID_TOKEN')
        } else if (response.code === 'INVALID_OR_ALREADY_VERIFIED') {
          // Email might already be verified - try to login
          setStatus('error')
          setMessage('This verification link is invalid or has already been used. If your email is verified, please log in.')
          setErrorCode('ALREADY_VERIFIED')
        } else {
          throw new Error(response.error || 'Unknown verification error')
        }
        return
      }

      // Fallback: treat any response without error as success
      setStatus('success')
      setMessage('✓ Your email has been verified successfully!')
    } catch (err: any) {
      console.error(`[FRONTEND] Email verification failed:`, err)
      setStatus('error')
      setMessage(err.message || 'Failed to verify email. The link may have expired.')
      setErrorCode('VERIFICATION_FAILED')
    }
  }

  const handleResendEmail = async () => {
    if (!email) {
      setMessage('Email address not found. Please sign up again.')
      return
    }

    setResendLoading(true)
    setResendSuccess(false)

    try {
      const response = await apiClient.request('/auth/resend-verification-email', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })

      if (response.error) {
        if (response.code === 'ALREADY_VERIFIED') {
          setMessage('Your email is already verified.')
          setStatus('success')
        } else {
          throw new Error(response.error)
        }
      } else {
        setResendSuccess(true)
        setMessage('✓ Verification email sent! Check your inbox (check spam folder too).')
        setTimeout(() => setResendSuccess(false), 5000)
      }
    } catch (err: any) {
      setMessage(`Failed to resend: ${err.message || 'Please try again later'}`)
    } finally {
      setResendLoading(false)
    }
  }

  useEffect(() => {
    // Prevent double verification in React StrictMode (development)
    if (!verificationAttemptedRef.current && token) {
      verificationAttemptedRef.current = true
      handleVerifyEmail()
    }
  }, [token])

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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified! 🎉</h1>
              <p className="text-gray-600 mb-6 text-lg">{message}</p>
              <p className="text-gray-500 mb-6 text-sm">Your email address has been confirmed. You're all set!</p>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-6 py-3 rounded-lg font-bold text-white transition hover:opacity-90"
                  style={{ backgroundColor: HERO_GOLD }}
                >
                  Continue to Login
                </button>
              </div>
            </>
          )}

          {status === 'expired' && (
            <>
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-orange-500" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
              <p className="text-gray-600 mb-6">Your verification link has expired (24-hour limit).</p>
              <div className="space-y-3">
                <div>
                  <button
                    onClick={handleResendEmail}
                    disabled={resendLoading || !email}
                    className="w-full flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: HERO_GOLD }}
                  >
                    {resendLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Resend Verification Email
                      </>
                    )}
                  </button>
                  {resendSuccess && (
                    <p className="text-green-600 text-sm mt-2">✓ {message}</p>
                  )}
                </div>
                <div>
                  <a href="/onboard" className="text-sm text-gray-600 hover:underline">
                    Create new account
                  </a>
                </div>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                {email && (
                  <div>
                    <button
                      onClick={handleResendEmail}
                      disabled={resendLoading}
                      className="w-full flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: HERO_GOLD }}
                    >
                      {resendLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Resend Verification Email
                        </>
                      )}
                    </button>
                    {resendSuccess && (
                      <p className="text-green-600 text-sm mt-2">✓ {message}</p>
                    )}
                  </div>
                )}
                <div>
                  <a
                    href="/onboard"
                    className="inline-block px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: HERO_GOLD }}
                  >
                    Create New Account
                  </a>
                </div>
                <div>
                  <a href="/login" className="text-sm text-gray-600 hover:underline block">
                    Already have an account? Log in
                  </a>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dev Testing Link (DEV MODE ONLY) */}
        {devLink && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6 text-center">
            <p className="text-xs font-semibold text-blue-900 mb-2">🔧 DEV MODE: Quick Testing</p>
            <p className="text-xs text-blue-700 mb-3">Email provider is down. Click below to verify instantly:</p>
            <a
              href={devLink}
              className="inline-block px-4 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
              style={{ backgroundColor: HERO_GOLD }}
            >
              Test Verification Link →
            </a>
          </div>
        )}

        {/* Help Text */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p className="flex items-center justify-center gap-2 mb-3">
            <Mail className="w-4 h-4" />
            Check your email for the verification link
          </p>
          <p className="text-xs text-gray-500">
            💡 Tip: Check your spam/junk folder if you don't see the email
          </p>
        </div>
      </div>
    </div>
  )
}

export default EmailVerificationPage

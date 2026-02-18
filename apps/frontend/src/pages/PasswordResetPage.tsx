import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Lock, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

const HERO_GOLD = '#D4AF37'

export const PasswordResetPage = () => {
    const { token } = useParams<{ token: string }>()
    const navigate = useNavigate()

    const [validating, setValidating] = useState(true)
    const [tokenValid, setTokenValid] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Validate token on mount
    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setErrorMessage('No reset token provided.')
                setValidating(false)
                return
            }

            try {
                const response = await apiClient.request(`/auth/verify-reset-token/${token}`, {
                    method: 'GET',
                })

                if (response.error) {
                    throw new Error(response.error)
                }

                setTokenValid(true)
            } catch (err: any) {
                setErrorMessage(err.message || 'This password reset link has expired or is invalid.')
            } finally {
                setValidating(false)
            }
        }

        validateToken()
    }, [token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        if (!password || !confirmPassword) {
            setError('Both password fields are required.')
            setLoading(false)
            return
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            setLoading(false)
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            setLoading(false)
            return
        }

        try {
            const response = await apiClient.request('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    token,
                    password,
                    confirmPassword,
                }),
            })

            if (response.error) {
                throw new Error(response.error)
            }

            setSuccess(true)
            setTimeout(() => navigate('/login'), 2000)
        } catch (err: any) {
            setError(err.message || 'Failed to reset password.')
        } finally {
            setLoading(false)
        }
    }

    // Loading state
    if (validating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: HERO_GOLD }} />
                    <p className="text-gray-600">Validating reset link...</p>
                </div>
            </div>
        )
    }

    // Invalid token state
    if (!tokenValid) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100 text-center">
                        <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
                        <p className="text-gray-600 mb-6">{errorMessage}</p>
                        <div className="space-y-3">
                            <a
                                href="/forgot-password"
                                className="inline-block px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
                                style={{ backgroundColor: HERO_GOLD }}
                            >
                                Request New Link
                            </a>
                            <div>
                                <a href="/login" className="text-sm text-gray-600 hover:underline">
                                    Back to Login
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100 text-center">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h1>
                        <p className="text-gray-600 mb-6">
                            Your password has been successfully reset. Redirecting to login...
                        </p>
                        <a
                            href="/login"
                            className="inline-block px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
                            style={{ backgroundColor: HERO_GOLD }}
                        >
                            Go to Login
                        </a>
                    </div>
                </div>
            </div>
        )
    }

    // Reset form
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Password</h1>
                        <p className="text-gray-600">Enter your new password below</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                New Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: HERO_GOLD }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Resetting...
                                </>
                            ) : (
                                <>
                                    <Lock className="w-5 h-5" />
                                    Reset Password
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                        <a href="/login" className="text-sm text-gray-600 hover:underline">
                            Back to Login
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PasswordResetPage

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

const HERO_GOLD = '#D4AF37'

export const ForgotPasswordPage = () => {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submitted, setSubmitted] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        if (!email) {
            setError('Please enter your email address.')
            setLoading(false)
            return
        }

        try {
            const response = await apiClient.request('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            })

            if (response.error) {
                throw new Error(response.error)
            }

            setSubmitted(true)
        } catch (err: any) {
            setError(err.message || 'Failed to send reset email.')
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Check Your Email</h1>
                        <p className="text-center text-gray-600 mb-6">
                            If an account exists with that email, we've sent password reset instructions to your inbox.
                            The link will expire in 1 hour.
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-2 px-4 rounded-lg font-bold text-white transition hover:opacity-90"
                                style={{ backgroundColor: HERO_GOLD }}
                            >
                                Return to Login
                            </button>
                            <button
                                onClick={() => setSubmitted(false)}
                                className="w-full py-2 px-4 rounded-lg font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 transition"
                            >
                                Try Another Email
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
                        <p className="text-gray-600">Enter your email and we'll send you a reset link</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
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
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Mail className="w-5 h-5" />
                                    Send Reset Link
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-sm font-bold transition hover:underline"
                            style={{ color: HERO_GOLD }}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ForgotPasswordPage

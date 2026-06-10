import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { CheckCircle, Loader2, RefreshCw, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

const HERO_GOLD = '#D4AF37'
const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

export const VerifyPhonePage = () => {
    const navigate = useNavigate()
    const location = useLocation()

    const { userId, phoneNumber, redirectTo } = (location.state as {
        userId?: string
        phoneNumber?: string
        redirectTo?: string
    }) || {}

    // Redirect away if navigated to directly without state
    useEffect(() => {
        if (!userId || !phoneNumber) {
            navigate('/register', { replace: true })
        }
    }, [userId, phoneNumber, navigate])

    const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS)
    const [resendLoading, setResendLoading] = useState(false)
    const [resendMessage, setResendMessage] = useState<string | null>(null)

    // Countdown for resend button
    useEffect(() => {
        if (resendCooldown <= 0) return
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
        return () => clearTimeout(timer)
    }, [resendCooldown])

    // ── OTP input handlers ──────────────────────────────────────────────────

    const handleOtpChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1)
        const next = [...otpDigits]
        next[index] = digit
        setOtpDigits(next)
        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
        if (!pasted) return
        const next = Array(OTP_LENGTH).fill('')
        pasted.split('').forEach((d, i) => { next[i] = d })
        setOtpDigits(next)
        const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
        inputRefs.current[focusIndex]?.focus()
    }

    // ── Resend OTP ──────────────────────────────────────────────────────────

    const handleResend = async () => {
        if (resendCooldown > 0 || !phoneNumber || !userId) return
        setResendLoading(true)
        setResendMessage(null)
        setError(null)

        try {
            // Re-trigger onboarding SMS by calling a dedicated resend endpoint.
            // The backend's /auth/resend-otp route invalidates old tokens and sends a fresh one.
            // If you don't have that route yet, see the note below.
            await apiClient.request('/auth/resend-otp', {
                method: 'POST',
                body: JSON.stringify({ userId, phoneNumber }),
            })
            setResendMessage('A new code has been sent to your phone.')
            setResendCooldown(RESEND_COOLDOWN_SECONDS)
            setOtpDigits(Array(OTP_LENGTH).fill(''))
            inputRefs.current[0]?.focus()
        } catch (err: any) {
            setError('Failed to resend code. Please try again.')
        } finally {
            setResendLoading(false)
        }
    }

    // ── Submit ──────────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const otp = otpDigits.join('')
        if (otp.length < OTP_LENGTH) {
            setError('Please enter the full 6-digit code.')
            return
        }

        setLoading(true)

        try {
            await apiClient.request('/auth/verify-otp', {
                method: 'POST',
                body: JSON.stringify({ userId, otp }),
            })
            setSuccess(true)
            setTimeout(() => navigate(redirectTo || '/login'), 2500)
        } catch (err: any) {
            setError(err.message || 'Invalid or expired code. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ── Success screen ──────────────────────────────────────────────────────

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100 text-center">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Phone Verified!</h1>
                        <p className="text-gray-600 mb-6">
                            Your account is active. Redirecting to login...
                        </p>
                        <Link
                            to="/login"
                            className="inline-block px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
                            style={{ backgroundColor: HERO_GOLD }}
                        >
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // ── Main form ───────────────────────────────────────────────────────────

    const maskedPhone = phoneNumber
        ? phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
        : ''

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100">

                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"
                            style={{ backgroundColor: `${HERO_GOLD}1A` }}
                        >
                            📱
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Phone</h1>
                        <p className="text-gray-600 text-sm">
                            We sent a 6-digit code to{' '}
                            <span className="font-semibold text-gray-800">{maskedPhone}</span>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {resendMessage && (
                            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                                {resendMessage}
                            </div>
                        )}

                        {/* OTP boxes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                                Enter verification code
                            </label>
                            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                                {otpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => { inputRefs.current[i] = el }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        className="w-11 h-14 text-center text-xl font-bold border-2 rounded-lg transition focus:outline-none"
                                        style={{
                                            borderColor: digit ? HERO_GOLD : '#D1D5DB',
                                            color: digit ? HERO_GOLD : '#111827',
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Resend */}
                            <div className="flex items-center justify-center mt-3 gap-1">
                                <span className="text-xs text-gray-500">Didn't receive it?</span>
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={resendCooldown > 0 || resendLoading}
                                    className="text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
                                    style={{ color: HERO_GOLD }}
                                >
                                    {resendLoading ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-3 h-3" />
                                    )}
                                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                                </button>
                            </div>
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
                                    Verifying...
                                </>
                            ) : (
                                'Verify & Activate Account'
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                        <Link
                            to="/register"
                            className="inline-flex items-center gap-2 text-sm font-bold transition hover:underline"
                            style={{ color: HERO_GOLD }}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to registration
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VerifyPhonePage
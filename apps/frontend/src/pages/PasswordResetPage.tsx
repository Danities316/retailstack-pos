import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Lock, Loader2, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

const HERO_GOLD = '#D4AF37'
const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

export const PasswordResetPage = () => {
    const navigate = useNavigate()
    const location = useLocation()

    // Passed from ForgotPasswordPage via navigate state
    const { userId, phoneNumber } = (location.state as { userId?: string; phoneNumber?: string }) || {}

    // OTP input — one digit per box
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // New password fields
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    // UI state
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Resend cooldown
    const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS)
    const [resendLoading, setResendLoading] = useState(false)
    const [resendMessage, setResendMessage] = useState<string | null>(null)

    // Redirect to forgot-password if navigated to directly without state
    useEffect(() => {
        if (!phoneNumber) {
            navigate('/forgot-password', { replace: true })
        }
    }, [phoneNumber, navigate])

    // Countdown timer for resend button
    useEffect(() => {
        if (resendCooldown <= 0) return
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
        return () => clearTimeout(timer)
    }, [resendCooldown])

    // ── OTP input handlers ──────────────────────────────────────────────────

    const handleOtpChange = (index: number, value: string) => {
        // Only accept single digits
        const digit = value.replace(/\D/g, '').slice(-1)
        const next = [...otpDigits]
        next[index] = digit
        setOtpDigits(next)

        // Auto-advance focus
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
        // Focus the last filled box or the one after
        const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
        inputRefs.current[focusIndex]?.focus()
    }

    // ── Resend OTP ──────────────────────────────────────────────────────────

    const handleResend = async () => {
        if (resendCooldown > 0 || !phoneNumber) return
        setResendLoading(true)
        setResendMessage(null)
        setError(null)

        try {
            await apiClient.request('/auth/forgot-password-sms', {
                method: 'POST',
                body: JSON.stringify({ phoneNumber }),
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

        if (!password) {
            setError('Please enter a new password.')
            return
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setLoading(true)

        try {
            await apiClient.request('/auth/reset-password-otp', {
                method: 'POST',
                body: JSON.stringify({ userId, otp, newPassword: password, confirmPassword }),
            })
            setSuccess(true)
            setTimeout(() => navigate('/login'), 2500)
        } catch (err: any) {
            setError(err.message || 'Failed to reset password. Please check your code and try again.')
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
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h1>
                        <p className="text-gray-600 mb-6">
                            Your password has been updated. Redirecting to login...
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
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Password</h1>
                        <p className="text-gray-600 text-sm">
                            Enter the 6-digit code sent to{' '}
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

                        {/* OTP Boxes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                                Verification Code
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

                        {/* New Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                New Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                required
                            />
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your new password"
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
                        <Link
                            to="/forgot-password"
                            className="inline-flex items-center gap-2 text-sm font-bold transition hover:underline"
                            style={{ color: HERO_GOLD }}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Use a different number
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PasswordResetPage


// import { useState, useEffect } from 'react'
// import { useParams, useNavigate } from 'react-router-dom'
// import { Lock, Loader2, CheckCircle, XCircle } from 'lucide-react'
// import { apiClient } from '@/lib/apiClient'

// const HERO_GOLD = '#D4AF37'

// export const PasswordResetPage = () => {
//     const { token } = useParams<{ token: string }>()
//     const navigate = useNavigate()

//     const [validating, setValidating] = useState(true)
//     const [tokenValid, setTokenValid] = useState(false)
//     const [errorMessage, setErrorMessage] = useState('')

//     const [password, setPassword] = useState('')
//     const [confirmPassword, setConfirmPassword] = useState('')
//     const [loading, setLoading] = useState(false)
//     const [error, setError] = useState<string | null>(null)
//     const [success, setSuccess] = useState(false)

//     // Validate token on mount
//     useEffect(() => {
//         const validateToken = async () => {
//             if (!token) {
//                 setErrorMessage('No reset token provided.')
//                 setValidating(false)
//                 return
//             }

//             try {
//                 const response = await apiClient.request(`/auth/verify-reset-token/${token}`, {
//                     method: 'GET',
//                 })

//                 if (response.error) {
//                     throw new Error(response.error)
//                 }

//                 setTokenValid(true)
//             } catch (err: any) {
//                 setErrorMessage(err.message || 'This password reset link has expired or is invalid.')
//             } finally {
//                 setValidating(false)
//             }
//         }

//         validateToken()
//     }, [token])

//     const handleSubmit = async (e: React.FormEvent) => {
//         e.preventDefault()
//         setError(null)
//         setLoading(true)

//         if (!password || !confirmPassword) {
//             setError('Both password fields are required.')
//             setLoading(false)
//             return
//         }

//         if (password.length < 8) {
//             setError('Password must be at least 8 characters.')
//             setLoading(false)
//             return
//         }

//         if (password !== confirmPassword) {
//             setError('Passwords do not match.')
//             setLoading(false)
//             return
//         }

//         try {
//             const response = await apiClient.request('/auth/reset-password', {
//                 method: 'POST',
//                 body: JSON.stringify({
//                     token,
//                     password,
//                     confirmPassword,
//                 }),
//             })

//             if (response.error) {
//                 throw new Error(response.error)
//             }

//             setSuccess(true)
//             setTimeout(() => navigate('/login'), 2000)
//         } catch (err: any) {
//             setError(err.message || 'Failed to reset password.')
//         } finally {
//             setLoading(false)
//         }
//     }

//     // Loading state
//     if (validating) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
//                 <div className="text-center">
//                     <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: HERO_GOLD }} />
//                     <p className="text-gray-600">Validating reset link...</p>
//                 </div>
//             </div>
//         )
//     }

//     // Invalid token state
//     if (!tokenValid) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
//                 <div className="w-full max-w-md">
//                     <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100 text-center">
//                         <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
//                         <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
//                         <p className="text-gray-600 mb-6">{errorMessage}</p>
//                         <div className="space-y-3">
//                             <a
//                                 href="/forgot-password"
//                                 className="inline-block px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
//                                 style={{ backgroundColor: HERO_GOLD }}
//                             >
//                                 Request New Link
//                             </a>
//                             <div>
//                                 <a href="/login" className="text-sm text-gray-600 hover:underline">
//                                     Back to Login
//                                 </a>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         )
//     }

//     // Success state
//     if (success) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
//                 <div className="w-full max-w-md">
//                     <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100 text-center">
//                         <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
//                         <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h1>
//                         <p className="text-gray-600 mb-6">
//                             Your password has been successfully reset. Redirecting to login...
//                         </p>
//                         <a
//                             href="/login"
//                             className="inline-block px-6 py-2 rounded-lg font-bold text-white transition hover:opacity-90"
//                             style={{ backgroundColor: HERO_GOLD }}
//                         >
//                             Go to Login
//                         </a>
//                     </div>
//                 </div>
//             </div>
//         )
//     }

//     // Reset form
//     return (
//         <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
//             <div className="w-full max-w-md">
//                 <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100">
//                     {/* Header */}
//                     <div className="mb-8 text-center">
//                         <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Password</h1>
//                         <p className="text-gray-600">Enter your new password below</p>
//                     </div>

//                     {/* Form */}
//                     <form onSubmit={handleSubmit} className="space-y-5">
//                         {error && (
//                             <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
//                                 {error}
//                             </div>
//                         )}

//                         <div>
//                             <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
//                                 New Password
//                             </label>
//                             <input
//                                 id="password"
//                                 type="password"
//                                 value={password}
//                                 onChange={(e) => setPassword(e.target.value)}
//                                 placeholder="At least 8 characters"
//                                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
//                                 required
//                             />
//                         </div>

//                         <div>
//                             <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
//                                 Confirm Password
//                             </label>
//                             <input
//                                 id="confirmPassword"
//                                 type="password"
//                                 value={confirmPassword}
//                                 onChange={(e) => setConfirmPassword(e.target.value)}
//                                 placeholder="Confirm your password"
//                                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
//                                 required
//                             />
//                         </div>

//                         <button
//                             type="submit"
//                             disabled={loading}
//                             className="w-full py-3 px-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50"
//                             style={{ backgroundColor: HERO_GOLD }}
//                         >
//                             {loading ? (
//                                 <>
//                                     <Loader2 className="w-5 h-5 animate-spin" />
//                                     Resetting...
//                                 </>
//                             ) : (
//                                 <>
//                                     <Lock className="w-5 h-5" />
//                                     Reset Password
//                                 </>
//                             )}
//                         </button>
//                     </form>

//                     {/* Footer */}
//                     <div className="mt-6 pt-6 border-t border-gray-200 text-center">
//                         <a href="/login" className="text-sm text-gray-600 hover:underline">
//                             Back to Login
//                         </a>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     )
// }

// export default PasswordResetPage

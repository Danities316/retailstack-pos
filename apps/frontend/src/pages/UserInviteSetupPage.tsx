import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

const HERO_GOLD = '#D4AF37'
const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

export const UserInviteSetupPage = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    // Step 1: enter phone + OTP   Step 2: set password
    const [step, setStep] = useState<'verify' | 'setup'>('verify')

    // Verify step
    const [phone, setPhone] = useState('')
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Setup step
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [userInfo, setUserInfo] = useState<{ name: string; role: string } | null>(null)

    // Shared state
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Resend cooldown
    const [resendCooldown, setResendCooldown] = useState(0) // starts at 0 — user hasn't sent yet
    const [resendLoading, setResendLoading] = useState(false)
    const [resendMessage, setResendMessage] = useState<string | null>(null)

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
        if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
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
        inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
    }

    // ── Step 1: verify phone + OTP ──────────────────────────────────────────

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const otp = otpDigits.join('')
        if (!phone.trim()) { setError('Please enter your phone number.'); return }
        if (otp.length < OTP_LENGTH) { setError('Please enter the full 6-digit code.'); return }

        setLoading(true)

        try {
            // setup-code-info just validates the OTP is correct and returns user info
            // without consuming the OTP — the actual consumption happens in setup-account-sms
            const response = await apiClient.request(
                `/auth/setup-code-info?phone=${encodeURIComponent(phone.trim())}`,
                { method: 'GET' }
            )

            setUserInfo({ name: response.name || '', role: response.role || '' })
            setStep('setup')
        } catch (err: any) {
            setError(err.message || 'Invalid phone number or setup code.')
        } finally {
            setLoading(false)
        }
    }

    // ── Step 2: set password ────────────────────────────────────────────────

    const handleCompleteSetup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
        if (password !== confirmPassword) { setError('Passwords do not match.'); return }

        setLoading(true)

        try {
            await apiClient.request('/auth/setup-account-sms', {
                method: 'POST',
                body: JSON.stringify({
                    phone: phone.trim(),
                    code: otpDigits.join(''),
                    password,
                }),
            })
            setSuccess(true)
            setTimeout(() => navigate('/login'), 2500)
        } catch (err: any) {
            setError(err.message || 'Failed to activate account. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ── Success ─────────────────────────────────────────────────────────────

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-10 text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Activated!</h1>
                    <p className="text-gray-600 mb-6">Your account is ready. Redirecting to login...</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2 rounded-lg font-bold text-white"
                        style={{ backgroundColor: HERO_GOLD }}
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        )
    }

    const maskedPhone = phone
        ? phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
        : ''

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

                    {/* Header */}
                    <div
                        className="px-8 py-6 text-center border-b-2"
                        style={{ backgroundColor: HERO_GOLD + '15', borderColor: HERO_GOLD }}
                    >
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to ADINO POS!</h1>
                        <p className="text-gray-600 text-sm">
                            {step === 'verify' ? 'Enter your phone number and setup code' : 'Create your password to activate your account'}
                        </p>
                    </div>

                    <div className="p-8">
                        {error && (
                            <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {/* ── Step 1: Verify ── */}
                        {step === 'verify' && (
                            <form onSubmit={handleVerify} className="space-y-5">
                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Your Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="e.g. 08012345678"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                        required
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        The number your manager used to invite you
                                    </p>
                                </div>

                                {/* OTP boxes */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                                        Setup Code (from SMS)
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
                                    {resendMessage && (
                                        <p className="text-xs text-green-700 text-center mt-2">{resendMessage}</p>
                                    )}
                                    <div className="flex items-center justify-center mt-3 gap-1">
                                        <span className="text-xs text-gray-500">Didn't receive it?</span>
                                        <span className="text-xs text-gray-400">Ask your manager to resend the invite.</span>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 px-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50"
                                    style={{ backgroundColor: HERO_GOLD }}
                                >
                                    {loading ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</>
                                    ) : (
                                        'Continue'
                                    )}
                                </button>
                            </form>
                        )}

                        {/* ── Step 2: Set Password ── */}
                        {step === 'setup' && (
                            <form onSubmit={handleCompleteSetup} className="space-y-5">
                                {/* User info summary */}
                                {userInfo && (
                                    <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 mb-2">
                                        {userInfo.name && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Name</span>
                                                <span className="font-medium text-gray-900">{userInfo.name}</span>
                                            </div>
                                        )}
                                        {userInfo.role && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Role</span>
                                                <span className="font-medium text-blue-600 capitalize">{userInfo.role.toLowerCase()}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Phone</span>
                                            <span className="font-medium text-gray-900">{maskedPhone}</span>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Lock className="inline w-4 h-4 mr-1" />
                                        Create Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="At least 8 characters"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
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
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Activating...</>
                                    ) : (
                                        'Activate My Account'
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setStep('verify'); setError(null) }}
                                    className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
                                >
                                    ← Back
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                <p className="text-center mt-4 text-sm text-gray-500">
                    Having trouble? Ask your manager to send a new invitation.
                </p>
            </div>
        </div>
    )
}

export default UserInviteSetupPage


// import { useState, useEffect } from 'react'
// import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { Lock, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
// import { apiClient } from '@/lib/apiClient'

// const HERO_GOLD = '#D4AF37'

// interface UserInvitationInfo {
//     email: string
//     name: string
//     role: string
//     tenantId: string
// }

// export const UserInviteSetupPage = () => {
//     const [searchParams] = useSearchParams()
//     const navigate = useNavigate()

//     // Get token from URL (for email invitations)
//     const tokenParam = searchParams.get('token')

//     // Form state
//     const [setupMethod, setSetupMethod] = useState<'token' | 'code' | null>(null)
//     const [userInfo, setUserInfo] = useState<UserInvitationInfo | null>(null)
//     const [email, setEmail] = useState('')
//     const [verificationCode, setVerificationCode] = useState('')
//     const [password, setPassword] = useState('')
//     const [confirmPassword, setConfirmPassword] = useState('')
//     const [loading, setLoading] = useState(tokenParam ? true : false)
//     const [submitting, setSubmitting] = useState(false)
//     const [error, setError] = useState<string | null>(null)
//     const [success, setSuccess] = useState<string | null>(null)
//     const [step, setStep] = useState<'verify' | 'setup'>('verify')

//     // Verify token if provided (email-based invite)
//     useEffect(() => {
//         const verifyToken = async () => {
//             if (!tokenParam) {
//                 setLoading(false)
//                 return
//             }

//             try {
//                 const response = await apiClient.request(`/auth/setup-account/${tokenParam}`)
//                 setUserInfo(response.user)
//                 setSetupMethod('token')
//                 setStep('setup') // Already verified, go straight to setup
//                 setLoading(false)
//             } catch (err: any) {
//                 setError(err.message || 'Invalid or expired invitation link')
//                 setLoading(false)
//             }
//         }

//         verifyToken()
//     }, [tokenParam])

//     // Verify code if user enters email (SMS-based invite)
//     const handleVerifyCode = async () => {
//         if (!email || !verificationCode) {
//             setError('Please enter your email and setup code')
//             return
//         }

//         setSubmitting(true)
//         setError(null)

//         try {
//             const response = await apiClient.request('/auth/setup-code-info', {
//                 method: 'GET',
//                 body: JSON.stringify({
//                     email,
//                     code: verificationCode
//                 })
//             })

//             if (response.error) {
//                 throw new Error(response.error)
//             }

//             setUserInfo(response.user || { email, name: '', role: '', tenantId: '' })
//             setSetupMethod('code')
//             setStep('setup')
//         } catch (err: any) {
//             setError(err.message || 'Invalid email or setup code')
//         } finally {
//             setSubmitting(false)
//         }
//     }

//     // Complete account setup (set password)
//     const handleCompleteSetup = async (e: React.FormEvent) => {
//         e.preventDefault()
//         setSubmitting(true)
//         setError(null)

//         if (!password || !confirmPassword) {
//             setError('Please enter a password')
//             setSubmitting(false)
//             return
//         }

//         if (password !== confirmPassword) {
//             setError('Passwords do not match')
//             setSubmitting(false)
//             return
//         }

//         if (password.length < 8) {
//             setError('Password must be at least 8 characters long')
//             setSubmitting(false)
//             return
//         }

//         try {
//             if (setupMethod === 'token' && tokenParam) {
//                 // Email-based: use token
//                 await apiClient.request('/auth/setup-account', {
//                     method: 'POST',
//                     body: JSON.stringify({
//                         token: tokenParam,
//                         password
//                     })
//                 })
//             } else if (setupMethod === 'code') {
//                 // SMS-based: use email and code
//                 await apiClient.request('/auth/setup-account-sms', {
//                     method: 'POST',
//                     body: JSON.stringify({
//                         email,
//                         code: verificationCode,
//                         password
//                     })
//                 })
//             }

//             setSuccess('✅ Account setup completed successfully!')

//             // Role-aware redirect
//             const redirectPath = userInfo?.role === 'CASHIER' ? '/pos' : userInfo?.role === 'MANAGER' ? '/dashboard' : '/login'
//             setTimeout(() => navigate(redirectPath), 2500)
//         } catch (err: any) {
//             setError(err.message || 'Failed to complete setup')
//         } finally {
//             setSubmitting(false)
//         }
//     }

//     if (loading) {
//         return (
//             <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
//                 <div className="text-center">
//                     <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: HERO_GOLD }} />
//                     <p className="text-gray-600">Verifying your invitation...</p>
//                 </div>
//             </div>
//         )
//     }

//     return (
//         <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
//             <div className="w-full max-w-md">
//                 {/* Card */}
//                 <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
//                     {/* Header */}
//                     <div className="p-8 text-center" style={{ backgroundColor: HERO_GOLD + '15', borderBottom: `2px solid ${HERO_GOLD}` }}>
//                         <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to ADINO POS!</h1>
//                         <p className="text-gray-600">Complete your account setup</p>
//                     </div>

//                     {/* Content */}
//                     <div className="p-8">
//                         {error && (
//                             <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
//                                 <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
//                                 <div>
//                                     <p className="text-sm font-medium text-red-900">{error}</p>
//                                 </div>
//                             </div>
//                         )}

//                         {success && (
//                             <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
//                                 <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
//                                 <div>
//                                     <p className="text-sm font-medium text-green-900">{success}</p>
//                                 </div>
//                             </div>
//                         )}

//                         {step === 'verify' && setupMethod === 'code' && (
//                             <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode() }} className="space-y-4">
//                                 <div>
//                                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                                         <Mail className="inline w-4 h-4 mr-2" />
//                                         Email Address
//                                     </label>
//                                     <Input
//                                         type="email"
//                                         value={email}
//                                         onChange={(e) => setEmail(e.target.value)}
//                                         placeholder="your@email.com"
//                                         required
//                                     />
//                                 </div>

//                                 <div>
//                                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                                         Setup Code (6 digits)
//                                     </label>
//                                     <Input
//                                         type="text"
//                                         maxLength={6}
//                                         value={verificationCode}
//                                         onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
//                                         placeholder="000000"
//                                         required
//                                     />
//                                     <p className="text-xs text-gray-500 mt-1">Check your SMS for the setup code</p>
//                                 </div>

//                                 <Button
//                                     type="submit"
//                                     disabled={submitting}
//                                     className="w-full text-white font-semibold py-2 rounded-lg transition"
//                                     style={{ backgroundColor: HERO_GOLD }}
//                                 >
//                                     {submitting ? 'Verifying...' : 'Verify Code'}
//                                 </Button>
//                             </form>
//                         )}

//                         {step === 'setup' && userInfo && (
//                             <form onSubmit={handleCompleteSetup} className="space-y-4">
//                                 {/* User Info Display */}
//                                 <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6">
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-gray-600">Email:</span>
//                                         <span className="text-sm font-medium text-gray-900">{userInfo.email}</span>
//                                     </div>
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-gray-600">Name:</span>
//                                         <span className="text-sm font-medium text-gray-900">{userInfo.name}</span>
//                                     </div>
//                                     <div className="flex justify-between">
//                                         <span className="text-sm text-gray-600">Role:</span>
//                                         <span className="text-sm font-medium text-blue-600 capitalize">{userInfo.role.toLowerCase()}</span>
//                                     </div>
//                                 </div>

//                                 {/* Password Section */}
//                                 <div>
//                                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                                         <Lock className="inline w-4 h-4 mr-2" />
//                                         Create Password
//                                     </label>
//                                     <Input
//                                         type="password"
//                                         value={password}
//                                         onChange={(e) => setPassword(e.target.value)}
//                                         placeholder="Enter a strong password"
//                                         required
//                                     />
//                                     <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
//                                 </div>

//                                 <div>
//                                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                                         Confirm Password
//                                     </label>
//                                     <Input
//                                         type="password"
//                                         value={confirmPassword}
//                                         onChange={(e) => setConfirmPassword(e.target.value)}
//                                         placeholder="Confirm your password"
//                                         required
//                                     />
//                                 </div>

//                                 <Button
//                                     type="submit"
//                                     disabled={submitting}
//                                     className="w-full text-white font-semibold py-2 rounded-lg transition"
//                                     style={{ backgroundColor: HERO_GOLD }}
//                                 >
//                                     {submitting ? (
//                                         <>
//                                             <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
//                                             Activating Account...
//                                         </>
//                                     ) : (
//                                         'Activate Account'
//                                     )}
//                                 </Button>

//                                 <p className="text-xs text-gray-500 text-center mt-4">
//                                     After activation, you can log in with your email and password
//                                 </p>
//                             </form>
//                         )}

//                         {error && !setupMethod && (
//                             <div className="text-center">
//                                 <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
//                                 <p className="text-gray-600 mb-6">Unable to load your invitation details</p>
//                                 <Button
//                                     onClick={() => navigate('/login')}
//                                     className="text-white font-semibold py-2 rounded-lg"
//                                     style={{ backgroundColor: HERO_GOLD }}
//                                 >
//                                     Go to Login
//                                 </Button>
//                             </div>
//                         )}
//                     </div>
//                 </div>

//                 {/* Help Text */}
//                 <div className="text-center mt-6 text-sm text-gray-600">
//                     <p>Having trouble? Contact your manager for a new invitation link</p>
//                 </div>
//             </div>
//         </div>
//     )
// }

// export default UserInviteSetupPage

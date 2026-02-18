import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Mail, Lock, User, Phone, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

const HERO_GOLD = '#D4AF37'
const baseURL = import.meta.env.VITE_API_BASE_URL

export const OnboardingPage = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const [form, setForm] = useState({
        tenantName: '',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
        confirmPassword: '',
        phoneNumber: '',
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        setLoading(true)

        // Validation
        if (!form.tenantName || !form.ownerName || !form.ownerEmail || !form.ownerPassword) {
            setError('All fields are required.')
            setLoading(false)
            return
        }

        if (form.ownerPassword.length < 8) {
            setError('Password must be at least 8 characters.')
            setLoading(false)
            return
        }

        if (form.ownerPassword !== form.confirmPassword) {
            setError('Passwords do not match.')
            setLoading(false)
            return
        }

        try {
            const response = await apiClient.request(`/auth/onboard`, {
                method: 'POST',
                body: JSON.stringify({
                    tenantName: form.tenantName,
                    ownerName: form.ownerName,
                    email: form.ownerEmail,
                    password: form.ownerPassword,
                    phoneNumber: form.phoneNumber,
                }),
            })

            if (response.error) {
                throw new Error(response.error || 'Onboarding failed')
            }

            setSuccess('✓ Tenant created successfully! Check your email to verify your account.')
            setTimeout(() => navigate('/login'), 2000)
        } catch (err: any) {
            setError(err.message || 'Failed to create tenant. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col lg:flex-row">
            {/* Left Half: Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12 lg:p-16">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ color: HERO_GOLD }}>
                            Welcome to ADINO POS
                        </h1>
                        <p className="text-gray-600">Set up your store in minutes</p>
                    </div>

                    {/* Form Card */}
                    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 space-y-5">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-start gap-2">
                                <span className="font-bold">✗</span>
                                <span>{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="p-4 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm flex items-start gap-2">
                                <span className="font-bold">✓</span>
                                <span>{success}</span>
                            </div>
                        )}

                        {/* Store Details Section */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Store className="w-4 h-4" />
                                Store Information
                            </h3>
                            <input
                                type="text"
                                name="tenantName"
                                placeholder="Store Name (e.g., Jane's Boutique)"
                                value={form.tenantName}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                required
                            />
                        </div>

                        {/* Owner Details Section */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Owner Account
                            </h3>

                            <div className="space-y-3">
                                <input
                                    type="text"
                                    name="ownerName"
                                    placeholder="Your Full Name"
                                    value={form.ownerName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                    required
                                />

                                <input
                                    type="email"
                                    name="ownerEmail"
                                    placeholder="Email Address (for login)"
                                    value={form.ownerEmail}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                    required
                                />

                                <input
                                    type="tel"
                                    name="phoneNumber"
                                    placeholder="Phone Number"
                                    value={form.phoneNumber}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                />

                                <input
                                    type="password"
                                    name="ownerPassword"
                                    placeholder="Password (min 8 characters)"
                                    value={form.ownerPassword}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                    required
                                />

                                <input
                                    type="password"
                                    name="confirmPassword"
                                    placeholder="Confirm Password"
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition"
                                    required
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-6 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: HERO_GOLD }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating Store...
                                </>
                            ) : (
                                'Create My Store'
                            )}
                        </button>

                        {/* Footer */}
                        <div className="text-center text-sm text-gray-600 pt-4 border-t">
                            Already have an account?{' '}
                            <a href="/login" className="font-bold hover:underline" style={{ color: HERO_GOLD }}>
                                Log in here
                            </a>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right Half: Benefits */}
            <div className="w-full lg:w-1/2 bg-gradient-to-br from-gray-800 to-gray-900 p-8 md:p-12 lg:p-16 flex items-center justify-center min-h-[300px] lg:min-h-screen">
                <div className="text-white max-w-md">
                    <h2 className="text-3xl font-bold mb-8">Why ADINO POS?</h2>
                    <ul className="space-y-4">
                        {[
                            'Offline-first POS system',
                            'Real-time sales tracking',
                            'Multi-user support',
                            'Inventory management',
                            'Whatsapp receipt & reporting',
                            'Works on any device',
                        ].map((benefit, idx) => (
                            <li key={idx} className="flex items-center gap-3">
                                <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-gray-900"
                                    style={{ backgroundColor: HERO_GOLD }}
                                >
                                    ✓
                                </div>
                                <span>{benefit}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default OnboardingPage

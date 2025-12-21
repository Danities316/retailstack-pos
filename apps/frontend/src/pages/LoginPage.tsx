import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
const baseURL = import.meta.env.VITE_API_BASE_URL
import { Mail, Lock, LogIn, Loader2, Home } from 'lucide-react';
import { Link } from 'react-router-dom'
import Image1 from '../assets/images/logo4.png'
import Image2 from '../assets/images/pos.png'




export const LoginPage = () => {
  const { setToken } = useAuth()
  const navigate = useNavigate()
  const { slug } = useParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')
      console.log("data:", data);

      // Extract access token and refresh token from response
      const { accessToken, refreshToken, user } = data.data || data
      setToken(accessToken || data.token, user || data.user, refreshToken)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  const HERO_GOLD = '#D4AF37';
  const currentStore = 'DANITIESTECH INTEGRATED SERVICES';




  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row">
      {/* Left Half: Login Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12 lg:p-16">
        <div className="w-full max-w-md">
          {/* Logo/Branding for Login Side (optional, could be just text) */}
          <div className="mb-8 text-center lg:text-left">
            {/* <h1 className="text-4xl text-center font-extrabold text-gray-900" style={{ color: HERO_GOLD }}>
              ADINO POS
            </h1> */}

            <img
              src={Image1}
              alt="ADINO POS Device"
              className="max-w-md mx-auto w-1/3 h-auto rounded-xl shadow-2xl transform scale-105"
            />
          </div>

          <h2 className="text-3xl text-center font-bold text-gray-800 mb-4">
            Log in to {slug}
          </h2>

          {/* Store/Service Information */}
          {/* <div className="flex items-center text-gray-600 text-base mb-6">
            <Home className="w-5 h-5 mr-2 text-gray-500" />
            <span className="font-semibold">{currentStore}</span>
            <Link to="/change-store" className="ml-2 text-sm text-[#D4AF37] hover:underline transition-colors duration-200">
              Not your store?
            </Link>
          </div> */}

          {/* Login Form Card */}
          <form
            onSubmit={handleLogin}
            className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100 space-y-6"
          >
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2" role="alert">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            {/* Email Input Group */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Username (Email)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input // Changed to standard input for better control over styling
                  id="email"
                  type="email"
                  placeholder="e.g., yourname@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 pr-4 py-3 w-full border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition duration-200"
                  required
                />
              </div>
            </div>

            {/* Password Input Group */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input // Changed to standard input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-4 py-3 w-full border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition duration-200"
                  required
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end text-sm">
              <Link to="/forgot-password" className="font-medium text-gray-600 hover:text-[#D4AF37] transition duration-200">
                Forgot your password?
              </Link>
            </div>

            {/* Submit Button */}
            <button // Changed to standard button
              type="submit"
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold text-white text-lg transition duration-300 transform hover:scale-[1.01] shadow-md"
              style={{ backgroundColor: HERO_GOLD }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Login
                </>
              )}
            </button>

          </form>

          {/* Optional: Footer Link/Sign Up Prompt */}
          <div className="text-center mt-6 text-sm text-gray-600">
            New to ADINO POS?{' '}
            <Link to="/request-demo" className="font-bold hover:text-gray-900" style={{ color: HERO_GOLD }}>
              Request a Demo
            </Link>
          </div>
        </div>
      </div>

      {/* Right Half: Visual/Product Showcase Section */}
      <div className="w-full lg:w-1/2 bg-[#2D3748] p-8 md:p-12 lg:p-16 flex items-center justify-center relative min-h-[300px] lg:min-h-screen">
        {/* Abstract Background Elements (for more appeal) */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(ellipse at center, ${HERO_GOLD} 0%, transparent 70%)` }}></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-900 opacity-60"></div> {/* Darker gradient for contrast */}

        <div className="relative z-10 text-white text-center">
          <img
            src={Image2} // Replace with your actual product image
            alt="ADINO POS Device"
            className="max-w-md mx-auto w-full h-auto rounded-xl shadow-2xl transform scale-105"
          />
          <h3 className="text-3xl font-bold mt-8 mb-2">
            Seamless Retail Management
          </h3>
          <p className="text-lg text-gray-300 max-w-sm mx-auto">
            Experience the future of offline-first point of sale, designed for African businesses.
          </p>
        </div>
      </div>
    </div>
  );
}

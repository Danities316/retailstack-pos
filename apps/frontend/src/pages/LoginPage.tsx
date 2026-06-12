import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { Phone, Mail, Lock, LogIn, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import Image1 from '../assets/images/logo4.png'
import Image2 from '../assets/images/POS.png'
import { saveOfflineSession, restoreOfflineSession } from '@/lib/offlineAuth'
import { openDatabase, putInStore } from '@/offline/db'
import { apiClient } from '@/lib/apiClient'
import { getPostLoginRoute } from '@/lib/postLoginRoute'

const baseURL = import.meta.env.VITE_API_BASE_URL
const HERO_GOLD = '#D4AF37'

// Detect whether the user typed a phone number or an email
function isPhoneNumber(value: string): boolean {
  return /^[0-9+\s\-()]{7,}$/.test(value.trim())
}

export const LoginPage = () => {
  const { setToken, isAuthenticated, user, onboarding } = useAuth()
  const navigate = useNavigate()
  const { slug } = useParams()

  // Reactive online status
  const [isOnline, setIsOnline] = React.useState(navigator.onLine)
  React.useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Offline redirect
  React.useEffect(() => {
    if (!navigator.onLine) {
      const offlineSession = restoreOfflineSession()
      if (offlineSession) navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  const [identifier, setIdentifier] = useState('') // phone or email
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derive which mode we're in based on what the user is typing
  const usingPhone = isPhoneNumber(identifier)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const body = usingPhone
        ? { phoneNumber: identifier.trim(), password }
        : { email: identifier.trim(), password }

      const res = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        // Phone not verified — redirect to OTP screen
        if (data.code === 'PHONE_NOT_VERIFIED') {
          navigate('/verify-phone', {
            state: {
              userId: data.userId,
              phoneNumber: data.phoneNumber,
              redirectTo: '/login',
            },
          })
          return
        }
        throw new Error(data.error || data.message || 'Login failed')
      }

      const { accessToken, refreshToken, user, onboarding } = data.data || data
      setToken(accessToken || data.token, user || data.user, refreshToken, onboarding || null)

      // Save session for offline access
      const userData = user || data.user
      if ((accessToken || data.token) && userData) {
        saveOfflineSession({
          token: accessToken || data.token,
          userId: userData.id,
          tenantId: userData.tenantId,
          userName: userData.name || userData.email,
          userEmail: userData.email,
        })
      }

      // Pre-cache products, categories, and recent sales for offline use
      try {
        const db = await openDatabase()

        const productsResponse = await apiClient.request('/products')
        const products = productsResponse.data || productsResponse
        if (Array.isArray(products)) {
          for (const product of products) {
            await putInStore(db, 'products', {
              ...product,
              meta: { version: product.version || 0, syncStatus: 'SYNCED', lastModifiedAt: new Date().toISOString() },
            })
          }
        }

        const categoriesResponse = await apiClient.request('/categories')
        const categories = categoriesResponse.data || categoriesResponse
        if (Array.isArray(categories)) {
          for (const category of categories) {
            await putInStore(db, 'categories', {
              ...category,
              meta: { version: category.version || 0, syncStatus: 'SYNCED', lastModifiedAt: new Date().toISOString() },
            })
          }
        }

        try {
          const salesResponse = await apiClient.request('/sales')
          const sales = salesResponse.data || salesResponse || []
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
          if (Array.isArray(sales)) {
            for (const sale of sales) {
              if (new Date(sale.createdAt).getTime() > thirtyDaysAgo) {
                await putInStore(db, 'sales', {
                  ...sale,
                  meta: { version: sale.version || 0, syncStatus: 'SYNCED', lastModifiedAt: new Date().toISOString() },
                })
              }
            }
          }
        } catch { /* non-critical */ }
      } catch (cacheErr: any) {
        console.warn('[LoginPage] Offline pre-cache failed (non-critical):', cacheErr.message)
      }

      const destination = getPostLoginRoute(userData, onboarding || null)
      navigate(destination)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Already logged in screen
  if (isAuthenticated && user) {
    const destination = getPostLoginRoute(user, onboarding)
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Logged In</h2>
          <p className="text-gray-600 mb-6">
            Welcome back, <span className="font-semibold">{user.name || user.email}</span>!
          </p>
          <Button onClick={() => navigate(destination)} className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-3">
            Go to Dashboard
          </Button>
          <button onClick={() => navigate('/')} className="w-full text-blue-600 hover:text-blue-700 font-medium">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row">
      {/* Left: Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12 lg:p-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <img src={Image1} alt="ADINO POS" className="max-w-md mx-auto w-1/3 h-auto rounded-xl shadow-2xl transform scale-105" />
          </div>

          <h2 className="text-3xl text-center font-bold text-gray-800 mb-6">
            Log in to {slug || 'ADINO POS'}
          </h2>

          <form onSubmit={handleLogin} className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100 space-y-5">
            {/* Offline notice */}
            {!isOnline && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 flex items-center gap-2">
                ⚡ You're offline. If you've logged in before, you'll be redirected automatically.
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2" role="alert">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            {/* Phone or Email — single adaptive field */}
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number or Email
              </label>
              <div className="relative">
                {usingPhone
                  ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  : <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                }
                <input
                  id="identifier"
                  type="text"
                  inputMode={usingPhone ? 'tel' : 'email'}
                  placeholder="e.g. 08012345678 or you@email.com"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="pl-11 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition duration-200"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {usingPhone ? '📱 Logging in with phone number' : '✉️ Logging in with email'}
              </p>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-11 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition duration-200"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end text-sm">
              <Link to="/forgot-password" className="font-medium text-gray-600 hover:text-[#D4AF37] transition duration-200">
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold text-white text-lg transition duration-300 hover:opacity-90 shadow-md disabled:opacity-50"
              style={{ backgroundColor: HERO_GOLD }}
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Logging in...</>
              ) : (
                <><LogIn className="w-5 h-5 mr-2" />Login</>
              )}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-gray-600">
            New to ADINO POS?{' '}
            <Link to="/request-demo" className="font-bold hover:text-gray-900" style={{ color: HERO_GOLD }}>
              Request a Demo
            </Link>
          </div>
        </div>
      </div>

      {/* Right: Visual */}
      <div className="w-full lg:w-1/2 bg-[#2D3748] p-8 md:p-12 lg:p-16 flex items-center justify-center relative min-h-[300px] lg:min-h-screen">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(ellipse at center, ${HERO_GOLD} 0%, transparent 70%)` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-900 opacity-60" />
        <div className="relative z-10 text-white text-center">
          <img src={Image2} alt="ADINO POS Device" className="max-w-md mx-auto w-full h-auto rounded-xl shadow-2xl transform scale-105" />
          <h3 className="text-3xl font-bold mt-8 mb-2">Seamless Retail Management</h3>
          <p className="text-lg text-gray-300 max-w-sm mx-auto">
            Experience the future of offline-first point of sale, designed for African businesses.
          </p>
        </div>
      </div>
    </div>
  )
}




// import React, { useState } from 'react'
// import { useNavigate, useParams } from 'react-router-dom'
// import { Input } from '@/components/ui/input'
// import { Button } from '@/components/ui/button'
// import { useAuth } from '@/context/AuthContext'
// import { Mail, Lock, LogIn, Loader2, Home } from 'lucide-react';
// import { Link } from 'react-router-dom';
// import Image1 from '../assets/images/logo4.png';
// import Image2 from '../assets/images/POS.png';
// import { saveOfflineSession, restoreOfflineSession } from '@/lib/offlineAuth'
// import { openDatabase, putInStore, getAllFromStore } from '@/offline/db'
// import { apiClient } from '@/lib/apiClient'
// import { getPostLoginRoute } from '@/lib/postLoginRoute'
// const baseURL = import.meta.env.VITE_API_BASE_URL




// export const LoginPage = () => {
//   const { setToken, isAuthenticated, user, onboarding } = useAuth()
//   const navigate = useNavigate()
//   const { slug } = useParams()

//   // Reactive online status
//   const [isOnline, setIsOnline] = React.useState(navigator.onLine)
//   React.useEffect(() => {
//     const on = () => setIsOnline(true)
//     const off = () => setIsOnline(false)
//     window.addEventListener('online', on)
//     window.addEventListener('offline', off)
//     return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
//   }, [])

//   // Offline redirect: if device is offline and a valid session exists,
//   // skip the login form entirely and go straight to dashboard.
//   React.useEffect(() => {
//     if (!navigator.onLine) {
//       const offlineSession = restoreOfflineSession()
//       if (offlineSession) {
//         // Valid offline session — redirect to dashboard without showing login form
//         navigate('/dashboard', { replace: true })
//       }
//     }
//   }, [navigate])

//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setLoading(true)
//     setError(null)
//     try {
//       const res = await fetch(`${baseURL}/auth/login`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ email, password }),
//       })
//       console.log("Response:", res);
//       const data = await res.json()

//       if (!res.ok) {
//         // Phone not verified — redirect to OTP screen instead of showing an error
//         if (data.code === 'PHONE_NOT_VERIFIED') {
//           navigate('/verify-phone', {
//             state: {
//               userId: data.userId,
//               phoneNumber: data.phoneNumber,
//               redirectTo: '/login',
//             },
//           })
//           return
//         }
//         throw new Error(data.error || data.message || 'Login failed')
//       }
//       // Extract access token, refresh token, user, and onboarding state from response
//       const { accessToken, refreshToken, user, onboarding } = data.data || data
//       setToken(accessToken || data.token, user || data.user, refreshToken, onboarding || null)

//       // Save session for offline access (3 days)
//       const userData = user || data.user
//       if ((accessToken || data.token) && userData) {
//         await saveOfflineSession({
//           token: accessToken || data.token,
//           userId: userData.id,
//           tenantId: userData.tenantId,
//           userName: userData.name || userData.email,
//           userEmail: userData.email,
//         })
//       }

//       // Pre-cache products, categories, and sales for offline use
//       try {
//         console.log('[LoginPage] Starting offline data pre-cache...')
//         const db = await openDatabase()

//         // Cache products
//         console.log('[LoginPage] Caching products...')
//         const productsResponse = await apiClient.request('/products')
//         const products = productsResponse.data || productsResponse
//         if (Array.isArray(products)) {
//           for (const product of products) {
//             await putInStore(db, 'products', {
//               ...product,
//               meta: {
//                 version: product.version || 0,
//                 syncStatus: 'SYNCED',
//                 lastModifiedAt: new Date().toISOString(),
//               },
//             })
//           }
//           console.log(`[LoginPage] Cached ${products.length} products`)
//         }

//         // Cache categories
//         console.log('[LoginPage] Caching categories...')
//         const categoriesResponse = await apiClient.request('/categories')
//         const categories = categoriesResponse.data || categoriesResponse
//         if (Array.isArray(categories)) {
//           for (const category of categories) {
//             await putInStore(db, 'categories', {
//               ...category,
//               meta: {
//                 version: category.version || 0,
//                 syncStatus: 'SYNCED',
//                 lastModifiedAt: new Date().toISOString(),
//               },
//             })
//           }
//           console.log(`[LoginPage] Cached ${categories.length} categories`)
//         }

//         // Cache recent sales (last 30 days)
//         try {
//           console.log('[LoginPage] Caching recent sales (last 30 days)...')
//           const salesResponse = await apiClient.request('/sales')
//           const sales = salesResponse.data || salesResponse || []
//           const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

//           let cachedCount = 0
//           if (Array.isArray(sales)) {
//             for (const sale of sales) {
//               const saleDate = new Date(sale.createdAt).getTime()
//               if (saleDate > thirtyDaysAgo) {
//                 await putInStore(db, 'sales', {
//                   ...sale,
//                   meta: {
//                     version: sale.version || 0,
//                     syncStatus: 'SYNCED',
//                     lastModifiedAt: new Date().toISOString(),
//                   },
//                 })
//                 cachedCount++
//               }
//             }
//           }
//           console.log(`[LoginPage] Cached ${cachedCount} recent sales`)
//         } catch (err) {
//           console.warn('[LoginPage] Failed to cache sales (non-critical):', err)
//         }

//         console.log('[LoginPage] Offline data pre-cache completed successfully')
//       } catch (cacheErr: any) {
//         console.warn('[LoginPage] Offline pre-cache failed (non-critical):', cacheErr.message)
//         // Continue with login even if caching fails
//       }

//       // Route to the correct destination based on role and onboarding state
//       const destination = getPostLoginRoute(userData, onboarding || null)
//       navigate(destination)
//     } catch (err: any) {
//       setError(err.message)
//     } finally {
//       setLoading(false)
//     }
//   }
//   const HERO_GOLD = '#D4AF37';
//   const currentStore = 'DANITIESTECH INTEGRATED SERVICES';

//   // Show message if already logged in
//   if (isAuthenticated && user) {
//     const destination = getPostLoginRoute(user, onboarding)
//     return (
//       <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
//         <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
//           <div className="mb-6">
//             <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
//               <LogIn className="w-8 h-8 text-blue-600" />
//             </div>
//           </div>
//           <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Logged In</h2>
//           <p className="text-gray-600 mb-6">
//             Welcome back, <span className="font-semibold">{user.name || user.email}</span>!
//           </p>
//           <p className="text-sm text-gray-500 mb-6">
//             You are already logged into your account. Go to your dashboard to continue working.
//           </p>
//           <Button
//             onClick={() => navigate(destination)}
//             className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-3"
//           >
//             Go to Dashboard
//           </Button>
//           <button
//             onClick={() => {
//               navigate('/')
//             }}
//             className="w-full text-blue-600 hover:text-blue-700 font-medium"
//           >
//             Back to Home
//           </button>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row">
//       {/* Left Half: Login Form Section */}
//       <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12 lg:p-16">
//         <div className="w-full max-w-md">
//           {/* Logo/Branding for Login Side (optional, could be just text) */}
//           <div className="mb-8 text-center lg:text-left">
//             {/* <h1 className="text-4xl text-center font-extrabold text-gray-900" style={{ color: HERO_GOLD }}>
//               ADINO POS
//             </h1> */}

//             <img
//               src={Image1}
//               alt="ADINO POS Device"
//               className="max-w-md mx-auto w-1/3 h-auto rounded-xl shadow-2xl transform scale-105"
//             />
//           </div>

//           <h2 className="text-3xl text-center font-bold text-gray-800 mb-4">
//             Log in to {slug}
//           </h2>

//           {/* Store/Service Information */}
//           {/* <div className="flex items-center text-gray-600 text-base mb-6">
//             <Home className="w-5 h-5 mr-2 text-gray-500" />
//             <span className="font-semibold">{currentStore}</span>
//             <Link to="/change-store" className="ml-2 text-sm text-[#D4AF37] hover:underline transition-colors duration-200">
//               Not your store?
//             </Link>
//           </div> */}

//           {/* Login Form Card */}
//           <form
//             onSubmit={handleLogin}
//             className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100 space-y-6"
//           >
//             {/* Offline Notice */}
//             {!isOnline && (
//               <div style={{
//                 background: '#fff7ed',
//                 border: '1px solid #fed7aa',
//                 borderRadius: 8,
//                 padding: '10px 14px',
//                 marginBottom: 16,
//                 fontSize: 13,
//                 color: '#c2410c',
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: 8,
//               }}>
//                 ⚡ You are offline. If you have logged in before, you will be redirected automatically.
//               </div>
//             )}

//             {/* Error Message */}
//             {error && (
//               <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2" role="alert">
//                 <span className="font-medium">Error:</span> {error}
//               </div>
//             )}

//             {/* Email Input Group */}
//             <div>
//               <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Username (Email)</label>
//               <div className="relative">
//                 <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
//                 <input // Changed to standard input for better control over styling
//                   id="email"
//                   type="email"
//                   placeholder="e.g., yourname@example.com"
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   className="pl-11 pr-4 py-3 w-full border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition duration-200"
//                   required
//                 />
//               </div>
//             </div>

//             {/* Password Input Group */}
//             <div>
//               <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
//                 <input // Changed to standard input
//                   id="password"
//                   type="password"
//                   placeholder="Enter your password"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   className="pl-11 pr-4 py-3 w-full border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition duration-200"
//                   required
//                 />
//               </div>
//             </div>

//             {/* Forgot Password Link */}
//             <div className="flex justify-end text-sm">
//               <Link to="/forgot-password" className="font-medium text-gray-600 hover:text-[#D4AF37] transition duration-200">
//                 Forgot your password?
//               </Link>
//             </div>

//             {/* Submit Button */}
//             <button // Changed to standard button
//               type="submit"
//               className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold text-white text-lg transition duration-300 transform hover:scale-[1.01] shadow-md"
//               style={{ backgroundColor: HERO_GOLD }}
//               disabled={loading}
//             >
//               {loading ? (
//                 <>
//                   <Loader2 className="w-5 h-5 mr-2 animate-spin" />
//                   Logging in...
//                 </>
//               ) : (
//                 <>
//                   <LogIn className="w-5 h-5 mr-2" />
//                   Login
//                 </>
//               )}
//             </button>

//           </form>

//           {/* Optional: Footer Link/Sign Up Prompt */}
//           <div className="text-center mt-6 text-sm text-gray-600">
//             New to ADINO POS?{' '}
//             <Link to="/request-demo" className="font-bold hover:text-gray-900" style={{ color: HERO_GOLD }}>
//               Request a Demo
//             </Link>
//           </div>
//         </div>
//       </div>

//       {/* Right Half: Visual/Product Showcase Section */}
//       <div className="w-full lg:w-1/2 bg-[#2D3748] p-8 md:p-12 lg:p-16 flex items-center justify-center relative min-h-[300px] lg:min-h-screen">
//         {/* Abstract Background Elements (for more appeal) */}
//         <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(ellipse at center, ${HERO_GOLD} 0%, transparent 70%)` }}></div>
//         <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-900 opacity-60"></div> {/* Darker gradient for contrast */}

//         <div className="relative z-10 text-white text-center">
//           <img
//             src={Image2}
//             alt="ADINO POS Device"
//             className="max-w-md mx-auto w-full h-auto rounded-xl shadow-2xl transform scale-105"
//           />
//           <h3 className="text-3xl font-bold mt-8 mb-2">
//             Seamless Retail Management
//           </h3>
//           <p className="text-lg text-gray-300 max-w-sm mx-auto">
//             Experience the future of offline-first point of sale, designed for African businesses.
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }

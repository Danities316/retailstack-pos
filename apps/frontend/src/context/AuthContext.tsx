import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import { restoreOfflineSession, clearOfflineSession } from '@/lib/offlineAuth'

interface User {
  id: string
  email: string
  role: string
  tenantId: string,
  name: string,
}

interface AuthContextType {
  token: string | null
  refreshToken: string | null
  setToken: (token: string | null, user?: User | null, refreshToken?: string | null) => void
  logout: () => Promise<void>
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  isLoggingOut: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(null)
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null)
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const setToken = (newToken: string | null, userObj?: User | null, newRefreshToken?: string | null) => {
    if (newToken) {
      localStorage.setItem('auth_token', newToken)
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken)
        setRefreshTokenState(newRefreshToken)
      }
      if (userObj) {
        localStorage.setItem('auth_user', JSON.stringify(userObj))
        setUserState(userObj)
      }
    } else {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_user')
      setRefreshTokenState(null)
      setUserState(null)
    }
    setTokenState(newToken)
  }

  const logout = async () => {
    // Mark as logging out (prevents offline session restore)
    setIsLoggingOut(true)
    console.log('[Auth] Logout initiated - clearing credentials')

    // Capture current token before clearing (for server call)
    const currentToken = token

    // CRITICAL: Clear auth state IMMEDIATELY (synchronous)
    // This prevents race condition where user refreshes during logout
    setToken(null)
    clearOfflineSession()

    try {
      // Then attempt server logout (non-blocking, even if fails)
      if (currentToken) {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentToken}` },
        })
        if (response.ok) {
          console.log('[Auth] ✅ Server logout successful')
        } else {
          console.warn('[Auth] ⚠️ Server logout returned status:', response.status)
        }
      }
    } catch (error) {
      // Server logout failed, but client is already logged out - this is OK
      console.error('[Auth] ⚠️ Server logout request failed (client already cleared):', error)
    } finally {
      setIsLoggingOut(false)
      // Redirect to login with clean history
      window.location.href = '/login'
    }
  }

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    const storedRefreshToken = localStorage.getItem('refresh_token')
    const storedUser = localStorage.getItem('auth_user')

    // Priority 1: Restore from regular auth (online login)
    if (storedToken) {
      setTokenState(storedToken)
      if (storedRefreshToken) setRefreshTokenState(storedRefreshToken)
      if (storedUser) setUserState(JSON.parse(storedUser))
      console.log('[AuthContext] Restored online session')
    }
    // Priority 2: Only restore offline session if:
    //   - No online token exists AND
    //   - NOT currently logging out AND
    //   - Valid offline session exists
    else if (!isLoggingOut) {
      const offlineSession = restoreOfflineSession()
      if (offlineSession) {
        setTokenState(offlineSession.token)
        const offlineUser = {
          id: offlineSession.userId,
          email: offlineSession.userEmail,
          name: offlineSession.userName,
          role: 'USER',
          tenantId: offlineSession.tenantId,
        }
        setUserState(offlineUser)
        // Only restore auth_user if token exists (don't create orphaned user state)
        localStorage.setItem('auth_user', JSON.stringify(offlineUser))
        console.log('[AuthContext] ✅ Restored offline session for:', offlineSession.userName)
      }
    }

    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = {
    token,
    refreshToken,
    setToken,
    logout,
    user,
    setUser: setUserState,
    isAuthenticated: !!token && !isLoggingOut,
    loading: loading || isLoggingOut,
    isLoggingOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

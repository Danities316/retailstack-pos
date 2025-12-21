import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'

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
  logout: () => void
  user: User | null
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(null)
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null)
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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
    try {
      // Call logout endpoint to revoke token on server
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setToken(null)
    }
  }

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    const storedRefreshToken = localStorage.getItem('refresh_token')
    const storedUser = localStorage.getItem('auth_user')
    if (storedToken) setTokenState(storedToken)
    if (storedRefreshToken) setRefreshTokenState(storedRefreshToken)
    if (storedUser) setUserState(JSON.parse(storedUser))
    setLoading(false)
  }, [])

  const value = {
    token,
    refreshToken,
    setToken,
    logout,
    user,
    setUser: setUserState,
    isAuthenticated: !!token,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

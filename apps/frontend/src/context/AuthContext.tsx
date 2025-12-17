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
  setToken: (token: string | null, user?: User | null) => void
  user: User | null
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(null)
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const setToken = (newToken: string | null, userObj?: User | null) => {
    if (newToken) {
      localStorage.setItem('auth_token', newToken)
      if (userObj) {
        localStorage.setItem('auth_user', JSON.stringify(userObj))
        setUserState(userObj)
      }
    } else {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      setUserState(null)
    }
    setTokenState(newToken)
  }

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')
    if (storedToken) setTokenState(storedToken)
    if (storedUser) setUserState(JSON.parse(storedUser))
    setLoading(false)
  }, [])

  const value = {
    token,
    setToken,
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

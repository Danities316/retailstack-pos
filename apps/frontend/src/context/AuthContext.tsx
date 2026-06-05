import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import { restoreOfflineSession, clearOfflineSession } from '@/lib/offlineAuth'
import type { OnboardingState } from '@/lib/postLoginRoute'

// Re-export so consumers can import the type from here
export type { OnboardingState }

interface User {
  id: string
  email: string
  role: string
  tenantId: string
  name: string
  isFirstLogin?: boolean
}

interface AuthContextType {
  token: string | null
  refreshToken: string | null
  /**
   * setToken signature is backward-compatible.
   * The new 4th param `onboarding` is optional — existing callers are unaffected.
   */
  setToken: (
    token: string | null,
    user?: User | null,
    refreshToken?: string | null,
    onboarding?: OnboardingState | null,
  ) => void
  /**
   * updateOnboarding — patch specific onboarding flags without re-login.
   * Called by onboarding pages after a successful product/sale action.
   */
  updateOnboarding: (patch: Partial<OnboardingState>) => void
  logout: () => Promise<void>
  user: User | null
  onboarding: OnboardingState | null
  isAuthenticated: boolean
  loading: boolean
  isLoggingOut: boolean
}

// localStorage keys — centralised to avoid typos
const STORAGE_KEYS = {
  token: 'auth_token',
  refreshToken: 'refresh_token',
  user: 'auth_user',
  onboarding: 'auth_onboarding', // new key — safe; old sessions just won't have it
} as const

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(null)
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null)
  const [user, setUserState] = useState<User | null>(null)
  const [onboarding, setOnboardingState] = useState<OnboardingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const setToken = (
    newToken: string | null,
    userObj?: User | null,
    newRefreshToken?: string | null,
    newOnboarding?: OnboardingState | null,
  ) => {
    if (newToken) {
      localStorage.setItem(STORAGE_KEYS.token, newToken)

      if (newRefreshToken) {
        localStorage.setItem(STORAGE_KEYS.refreshToken, newRefreshToken)
        setRefreshTokenState(newRefreshToken)
      }

      if (userObj) {
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userObj))
        setUserState(userObj)
      }

      // Only touch onboarding storage when the caller explicitly provides it
      if (newOnboarding !== undefined) {
        if (newOnboarding !== null) {
          localStorage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(newOnboarding))
        } else {
          localStorage.removeItem(STORAGE_KEYS.onboarding)
        }
        setOnboardingState(newOnboarding)
      }
    } else {
      // Clearing auth — wipe everything including onboarding
      localStorage.removeItem(STORAGE_KEYS.token)
      localStorage.removeItem(STORAGE_KEYS.refreshToken)
      localStorage.removeItem(STORAGE_KEYS.user)
      localStorage.removeItem(STORAGE_KEYS.onboarding)
      setRefreshTokenState(null)
      setUserState(null)
      setOnboardingState(null)
    }
    setTokenState(newToken)
  }

  const logout = async () => {
    // Mark as logging out (prevents offline session restore)
    setIsLoggingOut(true)
    console.log('[Auth] Logout initiated - clearing credentials')

    // Capture current token before clearing (for server call)
    const currentToken = token

    // CRITICAL: Clear auth state IMMEDIATELY
    // setToken(null) gates all auth checks. clearOfflineSession() clears the
    // in-memory cache synchronously (IDB removal happens async in background).
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
    const storedToken = localStorage.getItem(STORAGE_KEYS.token)
    const storedRefresh = localStorage.getItem(STORAGE_KEYS.refreshToken)
    const storedUser = localStorage.getItem(STORAGE_KEYS.user)
    const storedOnboarding = localStorage.getItem(STORAGE_KEYS.onboarding)

    const restoreOnboardingState = () => {
      if (storedOnboarding) {
        try {
          setOnboardingState(JSON.parse(storedOnboarding))
        } catch {
          localStorage.removeItem(STORAGE_KEYS.onboarding)
        }
      }
    }

    // Priority 1: Valid access token in storage — restore immediately
    if (storedToken) {
      setTokenState(storedToken)
      if (storedRefresh) setRefreshTokenState(storedRefresh)
      if (storedUser) {
        try { setUserState(JSON.parse(storedUser)) } catch { /* corrupt — ignore */ }
      }
      restoreOnboardingState()
      console.log('[AuthContext] Restored online session')
      setLoading(false)
      return
    }

    // Priority 2: No access token but refresh token exists and device is online
    // — attempt silent refresh before any component makes an API call
    if (storedRefresh && navigator.onLine) {
      console.log('[AuthContext] No access token found, attempting silent refresh...')

      fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedRefresh}`,
        },
      })
        .then(async res => {
          if (!res.ok) throw new Error('Refresh failed')
          return res.json()
        })
        .then(data => {
          const { accessToken, refreshToken: newRefresh } = data.data || data

          if (!accessToken) throw new Error('No access token in refresh response')

          // Persist new tokens
          localStorage.setItem(STORAGE_KEYS.token, accessToken)
          if (newRefresh) localStorage.setItem(STORAGE_KEYS.refreshToken, newRefresh)

          // Restore user from storage (still valid — only token changed)
          setTokenState(accessToken)
          if (newRefresh) setRefreshTokenState(newRefresh)
          if (storedUser) {
            try { setUserState(JSON.parse(storedUser)) } catch { /* corrupt */ }
          }
          restoreOnboardingState()

          console.log('[AuthContext] ✅ Silent refresh succeeded — session restored')
          setLoading(false)
        })
        .catch(err => {
          // Refresh token is expired or revoked — clear everything and
          // fall through to offline session or login screen
          console.warn('[AuthContext] Silent refresh failed:', err.message)
          localStorage.removeItem(STORAGE_KEYS.token)
          localStorage.removeItem(STORAGE_KEYS.refreshToken)
          localStorage.removeItem(STORAGE_KEYS.user)
          localStorage.removeItem(STORAGE_KEYS.onboarding)

          // Try offline session as last resort
          if (!isLoggingOut) {
            const offlineSession = restoreOfflineSession()
            if (offlineSession) {
              setTokenState(offlineSession.token)

              let restoredRole = 'CASHIER'
              try {
                const parts = offlineSession.token.split('.')
                if (parts.length === 3) {
                  const decoded = JSON.parse(atob(parts[1]))
                  if (decoded.role && typeof decoded.role === 'string') {
                    restoredRole = decoded.role
                  }
                }
              } catch { /* malformed — use fallback */ }

              const offlineUser: User = {
                id: offlineSession.userId,
                email: offlineSession.userEmail,
                name: offlineSession.userName,
                role: restoredRole,
                tenantId: offlineSession.tenantId,
              }
              setUserState(offlineUser)
              localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(offlineUser))
              console.log('[AuthContext] ✅ Fell back to offline session after failed refresh')
            }
          }
        })
        .finally(() => {
          setLoading(false)
        })
      return
    }

    // Priority 3: No access token, no refresh token, or offline
    // — try offline session
    if (!isLoggingOut) {
      const offlineSession = restoreOfflineSession()
      if (offlineSession) {
        setTokenState(offlineSession.token)

        let restoredRole = 'CASHIER'
        try {
          const parts = offlineSession.token.split('.')
          if (parts.length === 3) {
            const decoded = JSON.parse(atob(parts[1]))
            if (decoded.role && typeof decoded.role === 'string') {
              restoredRole = decoded.role
            }
          }
        } catch { /* malformed — use fallback */ }

        const offlineUser: User = {
          id: offlineSession.userId,
          email: offlineSession.userEmail,
          name: offlineSession.userName,
          role: restoredRole,
          tenantId: offlineSession.tenantId,
        }
        setUserState(offlineUser)
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(offlineUser))
        console.log('[AuthContext] ✅ Restored offline session for:', offlineSession.userName, 'role:', restoredRole)
      }
    }
    setLoading(false)
  }, [])

  // useEffect(() => {
  //   const storedToken = localStorage.getItem(STORAGE_KEYS.token)
  //   const storedRefresh = localStorage.getItem(STORAGE_KEYS.refreshToken)
  //   const storedUser = localStorage.getItem(STORAGE_KEYS.user)
  //   const storedOnboarding = localStorage.getItem(STORAGE_KEYS.onboarding)

  //   // Priority 1: Restore from regular auth (online login)
  //   if (storedToken) {
  //     setTokenState(storedToken)
  //     if (storedRefresh) setRefreshTokenState(storedRefresh)
  //     if (storedUser) {
  //       try { setUserState(JSON.parse(storedUser)) } catch { /* corrupt — ignore */ }
  //     }
  //     if (storedOnboarding) {
  //       try {
  //         setOnboardingState(JSON.parse(storedOnboarding))
  //       } catch {
  //         // Corrupt stored value — remove silently; user re-gets it on next login
  //         localStorage.removeItem(STORAGE_KEYS.onboarding)
  //       }
  //     }
  //     console.log('[AuthContext] Restored online session')
  //   }
  //   // Priority 2: Only restore offline session if:
  //   //   - No online token exists AND
  //   //   - NOT currently logging out AND
  //   //   - Valid offline session exists
  //   else if (!isLoggingOut) {
  //     const offlineSession = restoreOfflineSession()
  //     if (offlineSession) {
  //       setTokenState(offlineSession.token)

  //       // Decode the JWT to extract the real role — do NOT verify signature here
  //       // (no server available offline). The token was already verified at login time
  //       // and stored by offlineAuth. We trust it for role restoration only.
  //       let restoredRole = 'CASHIER' // safe fallback — most restrictive named role
  //       try {
  //         const parts = offlineSession.token.split('.')
  //         if (parts.length === 3) {
  //           const decoded = JSON.parse(atob(parts[1]))
  //           if (decoded.role && typeof decoded.role === 'string') {
  //             restoredRole = decoded.role
  //           }
  //         }
  //       } catch {
  //         // Malformed token — fallback to CASHIER, user can re-login when online
  //       }

  //       const offlineUser: User = {
  //         id: offlineSession.userId,
  //         email: offlineSession.userEmail,
  //         name: offlineSession.userName,
  //         role: restoredRole,
  //         tenantId: offlineSession.tenantId,
  //       }
  //       setUserState(offlineUser)
  //       localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(offlineUser))
  //       console.log('[AuthContext] ✅ Restored offline session for:', offlineSession.userName, 'role:', restoredRole)
  //     }
  //     // if (offlineSession) {
  //     //   setTokenState(offlineSession.token)
  //     //   const offlineUser: User = {
  //     //     id: offlineSession.userId,
  //     //     email: offlineSession.userEmail,
  //     //     name: offlineSession.userName,
  //     //     role: 'USER',
  //     //     tenantId: offlineSession.tenantId,
  //     //   }
  //     //   setUserState(offlineUser)
  //     //   localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(offlineUser))
  //     //   // Onboarding state is not available in offline sessions — null is handled
  //     //   // gracefully by getPostLoginRoute (falls through to /dashboard)
  //     //   console.log('[AuthContext] ✅ Restored offline session for:', offlineSession.userName)
  //     // }
  //   }

  //   setLoading(false)
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [])

  const updateOnboarding = (patch: Partial<OnboardingState>) => {
    setOnboardingState(prev => {
      const next: OnboardingState = {
        hasProduct: false,
        hasSale: false,
        hasInvitedUser: false,
        completed: false,
        ...prev,
        ...patch,
      }
      // Recompute derived `completed` field
      next.completed = next.hasProduct && next.hasSale
      localStorage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(next))
      return next
    })
  }

  const value = {
    token,
    refreshToken,
    setToken,
    updateOnboarding,
    logout,
    user,
    onboarding,
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


// import {
//   createContext,
//   useContext,
//   useEffect,
//   useState,
//   ReactNode,
// } from 'react'
// import { restoreOfflineSession, clearOfflineSession } from '@/lib/offlineAuth'
// import type { OnboardingState } from '@/lib/postLoginRoute'

// // Re-export so consumers can import the type from here
// export type { OnboardingState }

// interface User {
//   id: string
//   email: string
//   role: string
//   tenantId: string
//   name: string
//   isFirstLogin?: boolean
// }

// interface AuthContextType {
//   token: string | null
//   refreshToken: string | null
//   /**
//    * setToken signature is backward-compatible.
//    * The new 4th param `onboarding` is optional — existing callers are unaffected.
//    */
//   setToken: (
//     token: string | null,
//     user?: User | null,
//     refreshToken?: string | null,
//     onboarding?: OnboardingState | null,
//   ) => void
//   /**
//    * updateOnboarding — patch specific onboarding flags without re-login.
//    * Called by onboarding pages after a successful product/sale action.
//    */
//   updateOnboarding: (patch: Partial<OnboardingState>) => void
//   logout: () => Promise<void>
//   user: User | null
//   onboarding: OnboardingState | null
//   isAuthenticated: boolean
//   loading: boolean
//   isLoggingOut: boolean
// }

// // localStorage keys — centralised to avoid typos
// const STORAGE_KEYS = {
//   token: 'auth_token',
//   refreshToken: 'refresh_token',
//   user: 'auth_user',
//   onboarding: 'auth_onboarding', // new key — safe; old sessions just won't have it
// } as const

// const AuthContext = createContext<AuthContextType | undefined>(undefined)

// export const AuthProvider = ({ children }: { children: ReactNode }) => {
//   const [token, setTokenState] = useState<string | null>(null)
//   const [refreshToken, setRefreshTokenState] = useState<string | null>(null)
//   const [user, setUserState] = useState<User | null>(null)
//   const [onboarding, setOnboardingState] = useState<OnboardingState | null>(null)
//   const [loading, setLoading] = useState(true)
//   const [isLoggingOut, setIsLoggingOut] = useState(false)

//   const setToken = (
//     newToken: string | null,
//     userObj?: User | null,
//     newRefreshToken?: string | null,
//     newOnboarding?: OnboardingState | null,
//   ) => {
//     if (newToken) {
//       localStorage.setItem(STORAGE_KEYS.token, newToken)

//       if (newRefreshToken) {
//         localStorage.setItem(STORAGE_KEYS.refreshToken, newRefreshToken)
//         setRefreshTokenState(newRefreshToken)
//       }

//       if (userObj) {
//         localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userObj))
//         setUserState(userObj)
//       }

//       // Only touch onboarding storage when the caller explicitly provides it
//       if (newOnboarding !== undefined) {
//         if (newOnboarding !== null) {
//           localStorage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(newOnboarding))
//         } else {
//           localStorage.removeItem(STORAGE_KEYS.onboarding)
//         }
//         setOnboardingState(newOnboarding)
//       }
//     } else {
//       // Clearing auth — wipe everything including onboarding
//       localStorage.removeItem(STORAGE_KEYS.token)
//       localStorage.removeItem(STORAGE_KEYS.refreshToken)
//       localStorage.removeItem(STORAGE_KEYS.user)
//       localStorage.removeItem(STORAGE_KEYS.onboarding)
//       setRefreshTokenState(null)
//       setUserState(null)
//       setOnboardingState(null)
//     }
//     setTokenState(newToken)
//   }

//   const logout = async () => {
//     // Mark as logging out (prevents offline session restore)
//     setIsLoggingOut(true)
//     console.log('[Auth] Logout initiated - clearing credentials')

//     // Capture current token before clearing (for server call)
//     const currentToken = token

//     // CRITICAL: Clear auth state IMMEDIATELY (synchronous)
//     // This prevents race condition where user refreshes during logout
//     setToken(null)
//     clearOfflineSession()

//     try {
//       // Then attempt server logout (non-blocking, even if fails)
//       if (currentToken) {
//         const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/logout`, {
//           method: 'POST',
//           headers: { 'Authorization': `Bearer ${currentToken}` },
//         })
//         if (response.ok) {
//           console.log('[Auth] ✅ Server logout successful')
//         } else {
//           console.warn('[Auth] ⚠️ Server logout returned status:', response.status)
//         }
//       }
//     } catch (error) {
//       // Server logout failed, but client is already logged out - this is OK
//       console.error('[Auth] ⚠️ Server logout request failed (client already cleared):', error)
//     } finally {
//       setIsLoggingOut(false)
//       // Redirect to login with clean history
//       window.location.href = '/login'
//     }
//   }

//   useEffect(() => {
//     const storedToken = localStorage.getItem(STORAGE_KEYS.token)
//     const storedRefresh = localStorage.getItem(STORAGE_KEYS.refreshToken)
//     const storedUser = localStorage.getItem(STORAGE_KEYS.user)
//     const storedOnboarding = localStorage.getItem(STORAGE_KEYS.onboarding)

//     const restoreOnboardingState = () => {
//       if (storedOnboarding) {
//         try {
//           setOnboardingState(JSON.parse(storedOnboarding))
//         } catch {
//           localStorage.removeItem(STORAGE_KEYS.onboarding)
//         }
//       }
//     }

//     // Priority 1: Valid access token in storage — restore immediately
//     if (storedToken) {
//       setTokenState(storedToken)
//       if (storedRefresh) setRefreshTokenState(storedRefresh)
//       if (storedUser) {
//         try { setUserState(JSON.parse(storedUser)) } catch { /* corrupt — ignore */ }
//       }
//       restoreOnboardingState()
//       console.log('[AuthContext] Restored online session')
//       setLoading(false)
//       return
//     }

//     // Priority 2: No access token but refresh token exists and device is online
//     // — attempt silent refresh before any component makes an API call
//     if (storedRefresh && navigator.onLine) {
//       console.log('[AuthContext] No access token found, attempting silent refresh...')

//       fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${storedRefresh}`,
//         },
//       })
//         .then(async res => {
//           if (!res.ok) throw new Error('Refresh failed')
//           return res.json()
//         })
//         .then(data => {
//           const { accessToken, refreshToken: newRefresh } = data.data || data

//           if (!accessToken) throw new Error('No access token in refresh response')

//           // Persist new tokens
//           localStorage.setItem(STORAGE_KEYS.token, accessToken)
//           if (newRefresh) localStorage.setItem(STORAGE_KEYS.refreshToken, newRefresh)

//           // Restore user from storage (still valid — only token changed)
//           setTokenState(accessToken)
//           if (newRefresh) setRefreshTokenState(newRefresh)
//           if (storedUser) {
//             try { setUserState(JSON.parse(storedUser)) } catch { /* corrupt */ }
//           }
//           restoreOnboardingState()

//           console.log('[AuthContext] ✅ Silent refresh succeeded — session restored')
//           setLoading(false)
//         })
//         .catch(err => {
//           // Refresh token is expired or revoked — clear everything and
//           // fall through to offline session or login screen
//           console.warn('[AuthContext] Silent refresh failed:', err.message)
//           localStorage.removeItem(STORAGE_KEYS.token)
//           localStorage.removeItem(STORAGE_KEYS.refreshToken)
//           localStorage.removeItem(STORAGE_KEYS.user)
//           localStorage.removeItem(STORAGE_KEYS.onboarding)

//           // Try offline session as last resort
//           if (!isLoggingOut) {
//             const offlineSession = restoreOfflineSession()
//             if (offlineSession) {
//               setTokenState(offlineSession.token)

//               let restoredRole = 'CASHIER'
//               try {
//                 const parts = offlineSession.token.split('.')
//                 if (parts.length === 3) {
//                   const decoded = JSON.parse(atob(parts[1]))
//                   if (decoded.role && typeof decoded.role === 'string') {
//                     restoredRole = decoded.role
//                   }
//                 }
//               } catch { /* malformed — use fallback */ }

//               const offlineUser: User = {
//                 id: offlineSession.userId,
//                 email: offlineSession.userEmail,
//                 name: offlineSession.userName,
//                 role: restoredRole,
//                 tenantId: offlineSession.tenantId,
//               }
//               setUserState(offlineUser)
//               localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(offlineUser))
//               console.log('[AuthContext] ✅ Fell back to offline session after failed refresh')
//             }
//           }
//         })
//         .finally(() => {
//           setLoading(false)
//         })
//       return
//     }

//     // Priority 3: No access token, no refresh token, or offline
//     // — try offline session
//     if (!isLoggingOut) {
//       const offlineSession = restoreOfflineSession()
//       if (offlineSession) {
//         setTokenState(offlineSession.token)

//         let restoredRole = 'CASHIER'
//         try {
//           const parts = offlineSession.token.split('.')
//           if (parts.length === 3) {
//             const decoded = JSON.parse(atob(parts[1]))
//             if (decoded.role && typeof decoded.role === 'string') {
//               restoredRole = decoded.role
//             }
//           }
//         } catch { /* malformed — use fallback */ }

//         const offlineUser: User = {
//           id: offlineSession.userId,
//           email: offlineSession.userEmail,
//           name: offlineSession.userName,
//           role: restoredRole,
//           tenantId: offlineSession.tenantId,
//         }
//         setUserState(offlineUser)
//         localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(offlineUser))
//         console.log('[AuthContext] ✅ Restored offline session for:', offlineSession.userName, 'role:', restoredRole)
//       }
//     }
//     setLoading(false)
//   }, [])

//   // useEffect(() => {
//   //   const storedToken = localStorage.getItem(STORAGE_KEYS.token)
//   //   const storedRefresh = localStorage.getItem(STORAGE_KEYS.refreshToken)
//   //   const storedUser = localStorage.getItem(STORAGE_KEYS.user)
//   //   const storedOnboarding = localStorage.getItem(STORAGE_KEYS.onboarding)

//   //   // Priority 1: Restore from regular auth (online login)
//   //   if (storedToken) {
//   //     setTokenState(storedToken)
//   //     if (storedRefresh) setRefreshTokenState(storedRefresh)
//   //     if (storedUser) {
//   //       try { setUserState(JSON.parse(storedUser)) } catch { /* corrupt — ignore */ }
//   //     }
//   //     if (storedOnboarding) {
//   //       try {
//   //         setOnboardingState(JSON.parse(storedOnboarding))
//   //       } catch {
//   //         // Corrupt stored value — remove silently; user re-gets it on next login
//   //         localStorage.removeItem(STORAGE_KEYS.onboarding)
//   //       }
//   //     }
//   //     console.log('[AuthContext] Restored online session')
//   //   }
//   //   // Priority 2: Only restore offline session if:
//   //   //   - No online token exists AND
//   //   //   - NOT currently logging out AND
//   //   //   - Valid offline session exists
//   //   else if (!isLoggingOut) {
//   //     const offlineSession = restoreOfflineSession()
//   //     if (offlineSession) {
//   //       setTokenState(offlineSession.token)

//   //       // Decode the JWT to extract the real role — do NOT verify signature here
//   //       // (no server available offline). The token was already verified at login time
//   //       // and stored by offlineAuth. We trust it for role restoration only.
//   //       let restoredRole = 'CASHIER' // safe fallback — most restrictive named role
//   //       try {
//   //         const parts = offlineSession.token.split('.')
//   //         if (parts.length === 3) {
//   //           const decoded = JSON.parse(atob(parts[1]))
//   //           if (decoded.role && typeof decoded.role === 'string') {
//   //             restoredRole = decoded.role
//   //           }
//   //         }
//   //       } catch {
//   //         // Malformed token — fallback to CASHIER, user can re-login when online
//   //       }

//   //       const offlineUser: User = {
//   //         id: offlineSession.userId,
//   //         email: offlineSession.userEmail,
//   //         name: offlineSession.userName,
//   //         role: restoredRole,
//   //         tenantId: offlineSession.tenantId,
//   //       }
//   //       setUserState(offlineUser)
//   //       localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(offlineUser))
//   //       console.log('[AuthContext] ✅ Restored offline session for:', offlineSession.userName, 'role:', restoredRole)
//   //     }
//   //     // if (offlineSession) {
//   //     //   setTokenState(offlineSession.token)
//   //     //   const offlineUser: User = {
//   //     //     id: offlineSession.userId,
//   //     //     email: offlineSession.userEmail,
//   //     //     name: offlineSession.userName,
//   //     //     role: 'USER',
//   //     //     tenantId: offlineSession.tenantId,
//   //     //   }
//   //     //   setUserState(offlineUser)
//   //     //   localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(offlineUser))
//   //     //   // Onboarding state is not available in offline sessions — null is handled
//   //     //   // gracefully by getPostLoginRoute (falls through to /dashboard)
//   //     //   console.log('[AuthContext] ✅ Restored offline session for:', offlineSession.userName)
//   //     // }
//   //   }

//   //   setLoading(false)
//   //   // eslint-disable-next-line react-hooks/exhaustive-deps
//   // }, [])

//   const updateOnboarding = (patch: Partial<OnboardingState>) => {
//     setOnboardingState(prev => {
//       const next: OnboardingState = {
//         hasProduct: false,
//         hasSale: false,
//         hasInvitedUser: false,
//         completed: false,
//         ...prev,
//         ...patch,
//       }
//       // Recompute derived `completed` field
//       next.completed = next.hasProduct && next.hasSale
//       localStorage.setItem(STORAGE_KEYS.onboarding, JSON.stringify(next))
//       return next
//     })
//   }

//   const value = {
//     token,
//     refreshToken,
//     setToken,
//     updateOnboarding,
//     logout,
//     user,
//     onboarding,
//     setUser: setUserState,
//     isAuthenticated: !!token && !isLoggingOut,
//     loading: loading || isLoggingOut,
//     isLoggingOut,
//   }

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
// }

// export const useAuth = () => {
//   const context = useContext(AuthContext)
//   if (!context) throw new Error('useAuth must be used inside AuthProvider')
//   return context
// }


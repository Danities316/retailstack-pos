import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ReactNode } from 'react'
import { getPostLoginRoute } from '@/lib/postLoginRoute'

// Routes a CASHIER must never reach (they belong to owners/managers only)
const CASHIER_BLOCKED_PREFIXES = [
  '/dashboard/products',
  '/dashboard/categories',
  '/dashboard/users',
  '/dashboard/reports',
  '/dashboard/settings',
  '/dashboard/tenants',
]

interface ProtectedRouteProps {
  children: ReactNode
  /**
   * allowedRoles — optional whitelist. When provided, users whose role is
   * not in the list are redirected to their correct home route.
   * Leave undefined to allow any authenticated user (existing behavior).
   */
  allowedRoles?: string[]
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, loading, user, onboarding } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p>Loading...</p>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Role-based access control
  if (user) {
    // Explicit allowedRoles whitelist check
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to={getPostLoginRoute(user, onboarding)} replace />
    }

    // Cashier hard-block: cannot access any dashboard management route
    if (user.role === 'CASHIER') {
      const blocked = CASHIER_BLOCKED_PREFIXES.some((prefix) =>
        location.pathname.startsWith(prefix)
      )
      if (blocked) {
        return <Navigate to="/pos" replace />
      }
    }
  }

  return <>{children}</>
}



// import { Navigate } from 'react-router-dom'
// import { useAuth } from '@/context/AuthContext'
// import { ReactNode } from 'react'

// export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
//   const { isAuthenticated, loading } = useAuth()

//   if (loading) {
//     return <p>Loading...</p>
//   }

//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />
//   }

//   return <>{children}</>
// }

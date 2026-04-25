/**
 * AlreadyAuthenticatedRoute Component
 * Redirects authenticated users to their correct destination (role + onboarding aware).
 * Previously hard-coded to /dashboard — now uses getPostLoginRoute.
 */

import { useAuth } from '@/context/AuthContext'
import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { getPostLoginRoute } from '@/lib/postLoginRoute'

interface AlreadyAuthenticatedRouteProps {
    children: ReactNode
    redirectToDashboard?: boolean // Kept for backward compat; when true, redirect to role-correct route
}

export const AlreadyAuthenticatedRoute = ({
    children,
    redirectToDashboard = true,
}: AlreadyAuthenticatedRouteProps) => {
    const { isAuthenticated, loading, user, onboarding } = useAuth()

    if (loading) {
        return <p>Loading...</p>
    }

    if (isAuthenticated) {
        if (redirectToDashboard) {
            // Use role/onboarding-aware routing instead of hardcoded /dashboard
            const route = getPostLoginRoute(user, onboarding)
            return <Navigate to={route} replace />
        }
        // Return children so page can show "already logged in" message
        return <>{children}</>
    }

    // Not authenticated, show the page
    return <>{children}</>
}



// /**
//  * AlreadyAuthenticatedRoute Component
//  * Redirects authenticated users to dashboard
//  * Or shows them they're already logged in
//  */

// import { useAuth } from '@/context/AuthContext'
// import { Navigate } from 'react-router-dom'
// import { ReactNode } from 'react'

// interface AlreadyAuthenticatedRouteProps {
//     children: ReactNode
//     redirectToDashboard?: boolean // If true, redirect to dashboard; if false, show message
// }

// export const AlreadyAuthenticatedRoute = ({
//     children,
//     redirectToDashboard = true,
// }: AlreadyAuthenticatedRouteProps) => {
//     const { isAuthenticated, loading } = useAuth()

//     if (loading) {
//         return <p>Loading...</p>
//     }

//     // If already authenticated, either redirect or show children (page will handle messaging)
//     if (isAuthenticated) {
//         if (redirectToDashboard) {
//             return <Navigate to="/dashboard" replace />
//         }
//         // Return children so page can show "already logged in" message
//         return <>{children}</>
//     }

//     // Not authenticated, show login page
//     return <>{children}</>
// }

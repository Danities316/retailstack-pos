/**
 * AlreadyAuthenticatedRoute Component
 * Redirects authenticated users to dashboard
 * Or shows them they're already logged in
 */

import { useAuth } from '@/context/AuthContext'
import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'

interface AlreadyAuthenticatedRouteProps {
    children: ReactNode
    redirectToDashboard?: boolean // If true, redirect to dashboard; if false, show message
}

export const AlreadyAuthenticatedRoute = ({
    children,
    redirectToDashboard = true,
}: AlreadyAuthenticatedRouteProps) => {
    const { isAuthenticated, loading } = useAuth()

    if (loading) {
        return <p>Loading...</p>
    }

    // If already authenticated, either redirect or show children (page will handle messaging)
    if (isAuthenticated) {
        if (redirectToDashboard) {
            return <Navigate to="/dashboard" replace />
        }
        // Return children so page can show "already logged in" message
        return <>{children}</>
    }

    // Not authenticated, show login page
    return <>{children}</>
}

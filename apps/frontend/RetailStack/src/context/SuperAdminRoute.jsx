import { useAuth } from '@/context/AuthContext'
import { Navigate } from 'react-router-dom'

export const SuperAdminRoute = ({ children }) => {
  const { user, token } = useAuth()
  if (!token || !user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/login" replace />
  }
  return children
}
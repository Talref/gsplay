import { Navigate } from 'react-router'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  return loading ? null : user ? children : <Navigate to="/login" />
}

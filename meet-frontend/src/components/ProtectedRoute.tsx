import { Navigate, useLocation } from 'react-router-dom';
import { useAuthInitialized, useIsAuthenticated, useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const initialized = useAuthInitialized();
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!initialized) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

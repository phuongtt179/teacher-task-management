import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  // isSuperAdmin is an orthogonal flag (not a `role` value) — use this instead of
  // allowedRoles for platform-level routes, since a school's own admin can also
  // carry this flag (see the User type).
  requireSuperAdmin?: boolean;
}

export const ProtectedRoute = ({ children, allowedRoles, requireSuperAdmin }: ProtectedRouteProps) => {
  const { user, isLoading, isWhitelisted } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || isWhitelisted === false) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (requireSuperAdmin && !user.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
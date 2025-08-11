import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

interface GuestRouteProps {
  children: ReactNode;
}

const GuestRoute = ({ children }: GuestRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (isAuthenticated) {
    // Redirige vers le tableau de bord si l'utilisateur est déjà authentifié
    return <Navigate to="/" replace />;
  }

  return children;
};

export default GuestRoute;

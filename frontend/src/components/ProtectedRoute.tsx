import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Affiche un écran de chargement pendant la vérification de l'authentification
    return <div>Chargement...</div>;
  }

  if (!isAuthenticated) {
    // Redirige vers la page de connexion si l'utilisateur n'est pas authentifié
    // On transmet la destination initiale via l'état pour y revenir après connexion
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Affiche le composant enfant si l'utilisateur est authentifié
  return children;
};

export default ProtectedRoute;

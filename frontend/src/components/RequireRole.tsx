import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

// Composant de garde par rôle (RBAC) côté frontend
// Usage:
// <RequireRole roles={["admin"]}><AdminPage /></RequireRole>
// <RequireRole roles={["instructor","admin"]}><InstructorPage /></RequireRole>
interface RequireRoleProps {
  roles: Array<'player' | 'instructor' | 'admin'>;
  children: ReactNode;
}

const RequireRole = ({ roles, children }: RequireRoleProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Pendant la résolution de la session, on n'affiche rien de sensible
  if (isLoading) return <div>Chargement...</div>;

  // Si non connecté, on utilise le flux standard de redirection vers /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Si connecté mais rôle non autorisé → redirection vers la page d'accueil (ou 403 dédiée si prévue)
  const role = user?.role;
  if (!role || !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireRole;

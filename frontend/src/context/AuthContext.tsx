import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import api, { setOnUnauthorized, type ApiRequestConfig } from '../services/api';
import type { User, RegisterData } from '../types/auth';
import { AuthContext } from './auth-context';

// 3. Création du fournisseur de contexte
const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Enregistre un gestionnaire global pour les réponses 401/403
  useEffect(() => {
    // Lors d'une réponse non autorisée, on nettoie l'état et on redirige vers /login
    setOnUnauthorized(() => {
      setToken(null);
      setUser(null);
      try {
        localStorage.removeItem('token');
      } catch {
        // Ignoré: l'environnement peut ne pas permettre l'accès au stockage
      }
      window.location.assign('/login');
    });
    return () => {
      // Optionnel: retirer le handler au démontage
      setOnUnauthorized(() => {});
    };
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          // Note: Vous devez avoir une route comme /api/auth/me pour récupérer l'utilisateur
          const response = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(response.data.data.user);
        } catch (error) {
          console.error("Failed to fetch user", error);
          setToken(null);
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    // Important: on supprime la redirection automatique en cas de 401/403
    // pour laisser la page de connexion/les toasts gérer l'erreur côté UI.
    const response = await api.post('/auth/login', { email, password }, {
      suppressUnauthorizedHandler: true,
    } as ApiRequestConfig);
    const { token, user } = response.data.data;
    setToken(token);
    setUser(user);
    localStorage.setItem('token', token);
  }, []);

  const register = useCallback(async (userData: RegisterData) => {
    // Inscription: le backend envoie un email de vérification.
    // Aucun token n'est retourné à ce stade, l'utilisateur doit vérifier son email.
    await api.post('/auth/register', userData);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  }, []);

  const contextValue = {
    isAuthenticated: !!token,
    token,
    user,
    isLoading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;



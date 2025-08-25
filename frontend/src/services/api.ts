import axios, { type AxiosRequestConfig } from 'axios';

// Détermine une base API robuste et normalisée terminant par /api/v1
const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const normalizedBase = rawBase.replace(/\/$/, '');
const baseURL = normalizedBase.endsWith('/api/v1')
  ? normalizedBase
  : `${normalizedBase}/api/v1`;

const api = axios.create({ baseURL });

// Type de configuration étendu pour supporter des options internes
export type ApiRequestConfig = AxiosRequestConfig & {
  // Permet de désactiver le handler d'erreurs globales (toasts)
  skipGlobalErrorHandler?: boolean;
  // Permet de ne pas exécuter la logique 401/403 (ex: sur la page de login)
  suppressUnauthorizedHandler?: boolean;
};

// Gestionnaire d'actions à exécuter lors d'une réponse non autorisée (401/403)
let onUnauthorized: (() => void) | null = null;
// Gestionnaire global d'erreurs API (toasts)
let onGlobalApiError: ((error: unknown) => void) | null = null;

// Permet au contexte d'authentification d'enregistrer un handler de déconnexion
export const setOnUnauthorized = (fn: () => void) => {
  onUnauthorized = fn;
};

// Permet d'enregistrer un gestionnaire global d'erreurs API (ex: ToastProvider)
export const setOnGlobalApiError = (fn: (error: unknown) => void) => {
  onGlobalApiError = fn;
};

// Intercepteur requête: ajoute le token JWT si présent dans le stockage local
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    } as typeof config.headers;
  }
  return config;
});

// Intercepteur réponse: gère les 401 en forçant la déconnexion
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    // Récupère la configuration de la requête pour gérer les options internes
    const cfg = (error?.config as ApiRequestConfig | undefined);
    const suppressUnauthorized = cfg?.suppressUnauthorizedHandler === true;

    // Important: ne pas déconnecter sur 403 (refus d'accès), seulement sur 401 (non authentifié)
    if ((status === 401) && !suppressUnauthorized) {
      try {
        localStorage.removeItem('token');
      } catch (err) {
        if (import.meta.env.DEV) {
          // Journalisation non sensible en dev uniquement
          console.debug('localStorage indisponible pour la suppression du token', err);
        }
      }
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        // Fallback si aucun handler n'est enregistré
        window.location.assign('/login');
      }
    }

    // Déclenchement du gestionnaire d'erreurs globales sauf si opt-out explicite sur la requête
    const skipGlobal = cfg?.skipGlobalErrorHandler === true;
    if (!skipGlobal && onGlobalApiError) {
      onGlobalApiError(error);
    }
    return Promise.reject(error);
  }
);

export default api;
import axios, { type AxiosRequestConfig } from 'axios';

// L'URL de base de l'API. En production (Docker), il s'agit d'un chemin relatif (/api)
// qui est intercepté par le reverse proxy Nginx. En développement local (Vite dev server),
// ce serait une URL absolue (ex: http://localhost:5000/api).
const baseURL = import.meta.env.VITE_API_URL || '/api';

const apiTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000);
const api = axios.create({ baseURL, timeout: apiTimeout });

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
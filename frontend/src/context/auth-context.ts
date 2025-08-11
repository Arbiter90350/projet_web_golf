import { createContext } from 'react';
import type { AuthContextType } from '../types/auth';

// Contexte d'authentification (sans composant) — nécessaire pour le Fast Refresh
export const AuthContext = createContext<AuthContextType | null>(null);

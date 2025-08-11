import { createContext, useContext } from 'react';

// Contexte Toast — commentaires en français (règle projet)
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastContextValue {
  addToast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

// Hook pratique pour consommer le contexte
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider');
  return ctx;
}

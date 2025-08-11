import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { setOnGlobalApiError } from '../services/api';
import { getApiErrorMessage } from '../utils/apiError';
import { ToastContext, type ToastContextValue, type ToastType } from '../contexts/toast-context';

// Contexte et types pour les toasts — commentaires en français (règle projet)

const AUTO_DISMISS_MS = 4000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Ajoute un toast et le supprime automatiquement après un délai
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = { id, type, message };
    setToasts((prev) => [...prev, toast]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const ctxValue = useMemo<ToastContextValue>(() => ({
    addToast,
    success: (m) => addToast('success', m),
    error: (m) => addToast('error', m),
    info: (m) => addToast('info', m),
    warning: (m) => addToast('warning', m),
  }), [addToast]);

  // Enregistrement d'un gestionnaire d'erreurs API globales
  useEffect(() => {
    setOnGlobalApiError((err) => {
      const message = getApiErrorMessage(err);
      addToast('error', message);
    });
    return () => setOnGlobalApiError(() => {});
  }, [addToast]);

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      {/* Conteneur des toasts en overlay */}
      <div style={containerStyle}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...toastBaseStyle, ...typeStyles[t.type] }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Styles inline simples pour éviter une dépendance CSS supplémentaire
const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'none',
};

const toastBaseStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  padding: '10px 14px',
  borderRadius: 8,
  color: '#fff',
  boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
  minWidth: 240,
  maxWidth: 400,
  fontSize: 14,
};

const typeStyles: Record<ToastType, React.CSSProperties> = {
  success: { backgroundColor: '#16a34a' },
  error: { backgroundColor: '#dc2626' },
  info: { backgroundColor: '#2563eb' },
  warning: { backgroundColor: '#d97706' },
};

// Type interne pour la liste de toasts gérée par le provider
interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

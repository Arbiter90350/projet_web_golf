import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ToastProvider'
import i18n from './i18n'

// Référence explicite pour satisfaire noUncheckedSideEffectImports
void i18n

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

// Enregistrer le Service Worker (PWA) en production
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        // Logging non sensible
        console.warn('SW registration failed:', err)
      })
  })
}

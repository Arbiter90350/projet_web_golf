import React, { useEffect, useState } from 'react';

// Composant réutilisable pour afficher un bouton d'installation PWA sur Android (Chrome/Edge)
// Capture l'événement "beforeinstallprompt", stocke l'événement différé
// puis déclenche le prompt lorsque l'utilisateur clique.
//
// Remarque i18n: passez un libellé via props; côté appelant vous pouvez utiliser i18next
// avec un defaultValue pour éviter les chaînes en dur.
// Exemple: <PWAInstallPrompt label={t('common:actions.install_app', { defaultValue: "Installer l'application" })} />

type Props = {
  label: string;
  className?: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const PWAInstallPrompt: React.FC<Props> = ({ label, className }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installable, setInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);

  type NavigatorWithStandalone = Navigator & { standalone?: boolean };
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    Boolean((navigator as NavigatorWithStandalone).standalone)
  );
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroidChrome = /Android/i.test(ua) && /Chrome/i.test(ua);

  useEffect(() => {
    if (!isAndroidChrome || isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault?.();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallable(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [isAndroidChrome, isStandalone]);

  const onClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice; // attendre la réponse utilisateur
    } finally {
      // Après le prompt, l'événement ne peut pas être réutilisé
      setDeferredPrompt(null);
      setInstallable(false);
    }
  };

  if (!isAndroidChrome || isStandalone || installed || !installable) return null;

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {label}
    </button>
  );
};

export default PWAInstallPrompt;

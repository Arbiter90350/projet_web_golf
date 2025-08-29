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

  useEffect(() => {
    const handler = (e: Event) => {
      // Empêche le navigateur d'afficher la bannière automatique
      e.preventDefault?.();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

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

  if (!installable) return null;

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {label}
    </button>
  );
};

export default PWAInstallPrompt;

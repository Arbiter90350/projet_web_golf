// Bandeau d'activation des notifications — PWA iOS/Android uniquement
// Règles:
// - Affiché uniquement si Notification.permission === 'default'
// - Affiché uniquement en mode PWA (standalone) et sur plateformes iOS/Android
// - Au clic, déclenche la demande de permission et l'abonnement via subscribeCurrentDevice()
// - Si refus, afficher une courte aide pour ouvrir les réglages de notifications du navigateur/OS

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../contexts/toast-context';
import { subscribeCurrentDevice } from '../services/push';

function isStandalonePWA(): boolean {
  // iOS
  const iosStandalone = ('standalone' in window.navigator) && ((window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  // Standard
  const mq = window.matchMedia('(display-mode: standalone)');
  return iosStandalone || mq.matches;
}

function isIOS(): boolean {
  const ua = navigator.userAgent || navigator.vendor || '';
  return /iPad|iPhone|iPod/i.test(ua);
}

function isAndroid(): boolean {
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua);
}

export default function EnablePushBanner() {
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [deniedInfo, setDeniedInfo] = useState(false);

  const platform: 'ios' | 'android' | 'other' = useMemo(() => {
    if (isIOS()) return 'ios';
    if (isAndroid()) return 'android';
    return 'other';
  }, []);

  useEffect(() => {
    try {
      if (typeof Notification === 'undefined') return;
      const shouldShow = Notification.permission === 'default' && isStandalonePWA() && (platform === 'ios' || platform === 'android');
      setVisible(shouldShow);
      // Reagir aux changements d'affichage PWA (Android Chrome)
      const mq = window.matchMedia('(display-mode: standalone)');
      const onChange = () => {
        const v = typeof Notification !== 'undefined'
          && Notification.permission === 'default'
          && (mq.matches || (('standalone' in window.navigator) && ((window.navigator as Navigator & { standalone?: boolean }).standalone === true)))
          && (platform === 'ios' || platform === 'android');
        setVisible(v);
      };
      mq.addEventListener?.('change', onChange);
      return () => mq.removeEventListener?.('change', onChange);
    } catch {
      // ignore
    }
  }, [platform]);

  if (!visible) return null;

  const onEnable = async () => {
    try {
      setRequesting(true);
      const ok = await subscribeCurrentDevice();
      if (ok) {
        toast.success('Notifications activées');
        setVisible(false);
      } else {
        // L'utilisateur peut avoir refusé ou l'API peut être indisponible
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          setDeniedInfo(true);
        }
        toast.error("Activation non effectuée");
      }
    } catch {
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setDeniedInfo(true);
      toast.error("Impossible d'activer les notifications");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="tile" style={{ marginBottom: '1rem', padding: '0.75rem', display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>Activer les notifications</div>
      <div style={{ color: 'var(--text-muted)' }}>
        Recevez des alertes importantes directement sur votre appareil.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={onEnable} disabled={requesting}>
          {requesting ? 'Demande en cours…' : 'Activer'}
        </button>
        <button className="btn btn-outline" onClick={() => setVisible(false)}>
          Plus tard
        </button>
      </div>
      {deniedInfo && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#7c2d12', padding: '0.5rem 0.75rem', borderRadius: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Autorisation refusée</div>
          <div style={{ fontSize: 14 }}>
            {platform === 'ios' ? (
              <>
                Sur iOS, ouvrez les Réglages &gt; Notifications, sélectionnez l'application (PWA) et autorisez les notifications.
                Si vous ne voyez pas l'app, assurez-vous de l'avoir ajoutée à l'écran d'accueil.
              </>
            ) : (
              <>Sur Android, maintenez l'icône de l'application, puis Info de l'application &gt; Notifications et activez-les.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

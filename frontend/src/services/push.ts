// Service utilitaire pour Web Push (frontend)
// Commentaires en français (règle projet)

import api from './api';

// Conversion base64url -> UInt8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export type PushConfig = { publicKey: string; defaultIcon: string };

export async function getPushConfig(): Promise<PushConfig> {
  const { data } = await api.get('/push/config');
  return data?.data as PushConfig;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch {
    return null;
  }
}

export async function subscribeCurrentDevice(): Promise<boolean> {
  const reg = await registerServiceWorker();
  if (!reg) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const cfg = await getPushConfig();
  const existing = await reg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe().catch(() => undefined);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
  });
  // Envoyer au backend
  await api.post('/push/subscribe', JSON.parse(JSON.stringify(sub)));
  return true;
}

export async function unsubscribeCurrentDevice(): Promise<boolean> {
  const reg = await registerServiceWorker();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const raw = JSON.parse(JSON.stringify(sub));
  await api.post('/push/unsubscribe', { endpoint: raw.endpoint });
  await sub.unsubscribe().catch(() => undefined);
  return true;
}

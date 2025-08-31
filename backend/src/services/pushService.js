// Service d'envoi Web Push (VAPID)
// Commentaires en français — respecte les règles projet

const webpush = require('web-push');

function ensureConfigured() {
  const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT || 'mailto:contact@example.com';
  if (!pub || !priv) throw new Error('WEB_PUSH_VAPID_PUBLIC_KEY/PRIVATE_KEY manquants');
  webpush.setVapidDetails(subject, pub, priv);
  return { pub };
}

async function sendToSubscription(subscription, payload) {
  ensureConfigured();
  const body = JSON.stringify(payload);
  return webpush.sendNotification(subscription, body);
}

module.exports = { ensureConfigured, sendToSubscription };

import { useEffect, useState } from 'react';
import { useToast } from '../contexts/toast-context';
import api from '../services/api';
// Note: Icône par défaut fixée; on ne propose plus l'édition côté UI admin

// Page d'administration — Notifications Push (squelette UI)
// - Historique des notifications (placeholder)
// - Éditeur de nouvelle notification: titre, message, icône, actions (0..2)
// - Câblage API backend Web Push (subscribe/test/send)

export default function AdminPushNotificationsPage() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  // Icône masquée à l'UI: valeur par défaut fixée
  const DEFAULT_ICON = 'https://app.golf-rougemont.com/icons/icon-192.png';
  const [icon] = useState(DEFAULT_ICON);
  const [clickUrl, setClickUrl] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Aucun chargement distant requis pour l'icône par défaut
  }, []);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 className="mt-3">Notifications Push</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn-outline" href="/admin/tiles">Tuiles du Dashboard</a>
        </div>
      </div>

      <div className="grid grid-2 md:grid-1" style={{ marginTop: 12, gap: 12 }}>
        {/* Colonne 1: Historique (placeholder) */}
        <div className="tile" style={{ padding: '1rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Historique des envois</div>
          <div style={{ color: 'var(--text-muted)' }}>
            L'historique sera affiché ici (à implémenter lorsque l'API sera prête).
          </div>
        </div>

        {/* Colonne 2: Éditeur */}
        <div className="tile" style={{ padding: '1rem', display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Nouvelle notification</div>
          <label>
            <div>Titre</div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
          </label>
          <label>
            <div>Message</div>
            <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Votre message…" />
          </label>
          {/* Icône masquée côté UI: valeur par défaut utilisée côté envoi */}
          <label>
            <div>URL au clic (optionnel)</div>
            <input type="text" value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} placeholder="https://golf-rougemont.com/..." />
          </label>
          {/* Section Actions retirée de l'UI admin pour simplification */}
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={async () => { try { await api.post('/admin/push/test'); toast.success('Test envoyé'); } catch { toast.error('Échec test'); } }}>Test vers moi</button>
              <button className="btn btn-primary" disabled={sending || !title || !message || !icon} onClick={async () => {
                try {
                  setSending(true);
                  await api.post('/admin/push/messages', { title, body: message, icon, clickUrl: clickUrl || undefined, actions: [] });
                  toast.success('Notification envoyée');
                } catch {
                  toast.error('Échec envoi');
                } finally {
                  setSending(false);
                }
              }}>{sending ? 'Envoi…' : 'Envoyer'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

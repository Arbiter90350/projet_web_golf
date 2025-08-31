import { useEffect, useState } from 'react';
import { useToast } from '../contexts/toast-context';
import api from '../services/api';
import { getPushConfig, subscribeCurrentDevice, unsubscribeCurrentDevice } from '../services/push';

// Page d'administration — Notifications Push (squelette UI)
// - Historique des notifications (placeholder)
// - Éditeur de nouvelle notification: titre, message, icône, actions (0..2)
// - Câblage API backend Web Push (subscribe/test/send)

export default function AdminPushNotificationsPage() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [icon, setIcon] = useState('/icons/icon-192.png');
  const [clickUrl, setClickUrl] = useState('');
  const [actions, setActions] = useState<{ title: string; action: string; url: string }[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getPushConfig();
        setIcon(cfg.defaultIcon || '/icons/icon-192.png');
      } catch {
        // ignore
      }
    })();
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
          <label>
            <div>Icône</div>
            <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="URL icône (absolue de préférence)" />
          </label>
          <label>
            <div>URL au clic (optionnel)</div>
            <input type="text" value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} placeholder="https://golf-rougemont.com/..." />
          </label>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Actions (0..2)</div>
            {actions.map((a, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                <input placeholder="Titre" value={a.title} onChange={(e) => setActions(prev => prev.map((x, i) => i===idx ? { ...x, title: e.target.value } : x))} />
                <input placeholder="Action (ex: open)" value={a.action} onChange={(e) => setActions(prev => prev.map((x, i) => i===idx ? { ...x, action: e.target.value } : x))} />
                <input placeholder="URL" value={a.url} onChange={(e) => setActions(prev => prev.map((x, i) => i===idx ? { ...x, url: e.target.value } : x))} />
                <button className="btn btn-outline" onClick={() => setActions(prev => prev.filter((_, i) => i !== idx))}>Retirer</button>
              </div>
            ))}
            <button className="btn" disabled={actions.length >= 2} onClick={() => setActions(prev => [...prev, { title: '', action: 'open', url: '' }])}>Ajouter une action</button>
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={async () => { const ok = await subscribeCurrentDevice(); toast[ok ? 'success' : 'error'](ok ? 'Appareil abonné' : 'Abonnement refusé'); }}>Abonner cet appareil</button>
              <button className="btn btn-outline" onClick={async () => { const ok = await unsubscribeCurrentDevice(); toast[ok ? 'success' : 'error'](ok ? 'Appareil désabonné' : 'Échec désabonnement'); }}>Désabonner cet appareil</button>
              <button className="btn btn-outline" onClick={async () => { try { await api.post('/admin/push/test'); toast.success('Test envoyé'); } catch { toast.error('Échec test'); } }}>Test vers moi</button>
              <button className="btn btn-primary" disabled={sending || !title || !message || !icon} onClick={async () => {
                try {
                  setSending(true);
                  await api.post('/admin/push/messages', { title, body: message, icon, clickUrl: clickUrl || undefined, actions });
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

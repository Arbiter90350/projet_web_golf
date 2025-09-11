import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../contexts/toast-context';
import api from '../services/api';
import Modal from '../components/Modal';
import RichTextEditor from '../components/RichTextEditor';
import { htmlToPlainText } from '../utils/sanitize';
// Note: Icône par défaut fixée; on ne propose plus l'édition côté UI admin

// Page d'administration — Notifications Push (squelette UI)
// - Historique des notifications (placeholder)
// - Éditeur de nouvelle notification: titre, message, icône, actions (0..2)
// - Câblage API backend Web Push (subscribe/test/send)

type PushHistoryItem = {
  _id?: string;
  id?: string;
  title: string;
  body: string;
  clickUrl?: string;
  createdAt?: string;
};

export default function AdminPushNotificationsPage() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  // Icône masquée à l'UI: valeur par défaut fixée
  const DEFAULT_ICON = 'https://app.golf-rougemont.com/icons/icon-192.png';
  const [icon] = useState(DEFAULT_ICON);
  const [clickUrl, setClickUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<PushHistoryItem[]>([]);
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<PushHistoryItem | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get('/admin/push/messages', { params: { limit: 20 } });
      setHistory(res?.data?.data?.items ?? []);
    } catch {
      // Échec silencieux mais message discret pour l'admin
      toast.error('Impossible de charger l\'historique');
    }
  }, [toast]);

  useEffect(() => {
    // Aucun chargement distant requis pour l'icône par défaut
    void loadHistory();
  }, [loadHistory]);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 className="mt-3">Notifications Push</h2>
      </div>

      <div className="grid grid-2 md:grid-1" style={{ marginTop: 12, gap: 12 }}>
        {/* Colonne 1: Historique (placeholder) */}
        <div className="tile" style={{ padding: '1rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Historique des envois</div>
          {history.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Aucun envoi pour le moment.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {history.map((it, idx) => (
                <li key={it._id || it.id || idx}>
                  <button
                    className="tile"
                    style={{ width: '100%', textAlign: 'left', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                    onClick={() => { setSelected(it); setOpened(true); }}
                  >
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Colonne 2: Éditeur */}
        <div className="tile" style={{ padding: '1rem', display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Nouvelle notification</div>
          <label>
            <div>Titre</div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" style={{ width: '100%' }} />
          </label>
          <label>
            <div>Message</div>
            <RichTextEditor value={message} onChange={setMessage} placeholder="Votre message…" />
          </label>
          {/* Icône masquée côté UI: valeur par défaut utilisée côté envoi */}
          <label>
            <div>URL au clic (optionnel)</div>
            <input type="text" value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} placeholder="https://golf-rougemont.com/..." style={{ width: '100%' }} />
          </label>
          {/* Section Actions retirée de l'UI admin pour simplification */}
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={async () => { try { await api.post('/admin/push/test'); toast.success('Test envoyé'); } catch { toast.error('Échec test'); } }}>Test vers moi</button>
              <button className="btn btn-primary" disabled={sending || !title || !message || !icon} onClick={async () => {
                try {
                  setSending(true);
                  await api.post('/admin/push/messages', { title, body: htmlToPlainText(message), icon, clickUrl: clickUrl || undefined, actions: [] });
                  toast.success('Notification envoyée');
                  await loadHistory();
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
      <Modal open={opened} onClose={() => setOpened(false)} title={selected?.title || 'Détails de l\'envoi'} width={700}>
        {selected ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Date</div>
              <div>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Contenu</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</div>
            </div>
            {selected.clickUrl ? (
              <div>
                <div style={{ color: 'var(--text-muted)' }}>URL</div>
                <a href={selected.clickUrl} target="_blank" rel="noreferrer">{selected.clickUrl}</a>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

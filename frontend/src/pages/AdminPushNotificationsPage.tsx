import { useState } from 'react';
import FilePicker from '../components/FileManager/FilePicker';
import type { PickedFile } from '../components/FileManager/FilePicker';

// Page d'administration — Notifications Push (squelette UI)
// - Historique des notifications (placeholder)
// - Éditeur de nouvelle notification: titre, message, média optionnel
// - Câblage API à faire plus tard (backend non implémenté)

export default function AdminPushNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [mediaFileName, setMediaFileName] = useState('');

  const onPicked = (f: PickedFile) => setMediaFileName(f.fileName);

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
            <div>Fichier média (optionnel)</div>
            <input type="text" value={mediaFileName} onChange={(e) => setMediaFileName(e.target.value)} placeholder="Nom du fichier (Object Storage)" />
            <div style={{ marginTop: 8 }}>
              <FilePicker mode="inline" onSelect={onPicked} />
            </div>
          </label>
          <div>
            {/* Bouton désactivé tant que l'API n'est pas branchée */}
            <button className="btn btn-primary" disabled>Envoyer (à venir)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

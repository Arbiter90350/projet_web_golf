import { useEffect, useState } from 'react';
import api from '../services/api';
import FilePicker from '../components/FileManager/FilePicker';
import type { PickedFile } from '../components/FileManager/FilePicker';

// Page d'administration: édition simple de 2 tuiles du dashboard
// - dashboard.green_card_schedule
// - dashboard.events
// Sécurité: route protégée côté App (RequireRole admin)

type Setting = {
  key: string;
  content: string;
  mediaFileName: string | null;
  mediaUrl: string | null;
  updatedAt?: string;
};

function TileEditor({ label, settingKey }: { label: string; settingKey: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [mediaFileName, setMediaFileName] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/settings/${encodeURIComponent(settingKey)}`);
      const s = (data?.data?.setting ?? null) as Setting | null;
      setContent(s?.content ?? '');
      setMediaFileName(s?.mediaFileName ?? '');
      setMediaUrl(s?.mediaUrl ?? null);
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingKey]);

  const onPicked = (f: PickedFile) => setMediaFileName(f.fileName);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const { data } = await api.put(`/settings/${encodeURIComponent(settingKey)}`, {
        content: content || undefined,
        mediaFileName: mediaFileName || undefined,
      });
      const s = data?.data?.setting as Setting;
      setMediaUrl(s?.mediaUrl ?? null);
    } catch {
      setError('Échec de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tile" style={{ padding: '1rem', display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      {loading ? (
        <div>Chargement…</div>
      ) : (
        <>
          <label>
            <div>Texte</div>
            <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
          </label>
          <label>
            <div>Fichier média (optionnel)</div>
            <input type="text" value={mediaFileName} onChange={(e) => setMediaFileName(e.target.value)} placeholder="Nom du fichier (Object Storage)" />
            <div style={{ marginTop: 8 }}>
              <FilePicker mode="inline" onSelect={onPicked} />
            </div>
            {mediaUrl && (
              <div style={{ marginTop: 8 }}>
                <a href={mediaUrl} target="_blank" rel="noreferrer">Ouvrir le média</a>
              </div>
            )}
          </label>
          {error && <div style={{ color: 'crimson' }}>{error}</div>}
          <div>
            <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminTilesPage() {
  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 className="mt-3">Tuiles du dashboard</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn-outline" href="/admin/push-notifications">Notifications Push</a>
        </div>
      </div>

      <div className="grid grid-2 md:grid-1" style={{ marginTop: 12, gap: 12 }}>
        <TileEditor label="Horaire des leçons (carte verte)" settingKey="dashboard.green_card_schedule" />
        <TileEditor label="Communication / Événement" settingKey="dashboard.events" />
      </div>
    </div>
  );
}

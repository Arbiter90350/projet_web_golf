import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import FilePicker from '../components/FileManager/FilePicker';
import type { PickedFile } from '../components/FileManager/FilePicker';
import { useToast } from '../contexts/toast-context';

// Page d'administration: édition simple de 2 tuiles du dashboard
// - dashboard.green_card_schedule
// - dashboard.events
// Sécurité: route protégée côté App (RequireRole admin)

type Setting = {
  key: string;
  title?: string | null;
  content: string;
  mediaFileName: string | null;
  mediaUrl: string | null;
  updatedAt?: string;
};

function TileEditor({ settingKey }: { settingKey: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaFileName, setMediaFileName] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tempPickedFileName, setTempPickedFileName] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/settings/${encodeURIComponent(settingKey)}`);
      const s = (data?.data?.setting ?? null) as Setting | null;
      setTitle(s?.title ?? '');
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

  const onPicked = (f: PickedFile) => setTempPickedFileName(f.fileName);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      if (!title.trim()) {
        setError('Le titre est obligatoire');
        toast.error('Le titre est obligatoire');
        setSaving(false);
        return;
      }
      const payload = {
        title: title,
        content: content || undefined,
        // IMPORTANT: si vide, envoyer null pour effacer côté serveur (undefined = pas de changement)
        mediaFileName: mediaFileName === '' ? null : mediaFileName,
      } as const;
      const { data } = await api.put(`/settings/${encodeURIComponent(settingKey)}`, payload);
      const s = data?.data?.setting as Setting;
      setTitle(s?.title ?? '');
      setMediaUrl(s?.mediaUrl ?? null);
      toast.success('Contenu enregistré');
    } catch {
      setError('Échec de la sauvegarde');
      toast.error('Échec de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tile" style={{ padding: '1rem', display: 'grid', gap: 8 }}>
      {loading ? (
        <div>Chargement…</div>
      ) : (
        <>
          <label>
            <div>Titre</div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la tuile" required />
          </label>
          <label>
            <div>Texte</div>
            <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
          </label>
          {/* Zone contenus en cours + action d'ajout via modale */}
          <div>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Contenus ajoutés</div>
            {mediaFileName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <span style={{ fontFamily: 'monospace' }}>{mediaFileName}</span>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setMediaFileName('');
                    setMediaUrl(null);
                    toast.info('Média retiré. Cliquez sur "Sauvegarder" pour confirmer.');
                  }}
                >
                  Retirer
                </button>
                {mediaUrl && (
                  <a className="btn" href={mediaUrl} target="_blank" rel="noreferrer">Prévisualiser</a>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>Aucun contenu média sélectionné</div>
            )}
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => { setTempPickedFileName(''); setModalOpen(true); }}>Ajouter du contenu</button>
            </div>
          </div>

          {/* Modale de sélection média */}
          {modalOpen && (
            <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'grid', placeItems: 'center' }}>
              <div className="tile" style={{ width: 'min(860px, 92vw)', maxHeight: '85vh', overflow: 'auto', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Ajouter un contenu</div>
                  <button className="btn btn-outline" onClick={() => setModalOpen(false)}>✕</button>
                </div>
                <label>
                  <div>Fichier média (optionnel)</div>
                  <input type="text" value={tempPickedFileName} onChange={(e) => setTempPickedFileName(e.target.value)} placeholder="Nom du fichier (Object Storage)" />
                </label>
                <div style={{ marginTop: 8 }}>
                  <FilePicker mode="inline" onSelect={onPicked} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={() => { setMediaFileName(tempPickedFileName); setModalOpen(false); }}>Ajouter</button>
                </div>
              </div>
            </div>
          )}

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
  const toast = useToast();
  const [dynamicTiles, setDynamicTiles] = useState<Setting[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const loadDynamic = useCallback(async () => {
    try {
      setLoadingList(true);
      const { data } = await api.get('/settings/list', { params: { prefix: 'dashboard.tile.' } });
      const list = (data?.data?.settings ?? []) as Setting[];
      setDynamicTiles(list);
    } catch {
      toast.error('Chargement des tuiles dynamiques impossible');
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  useEffect(() => { void loadDynamic(); }, [loadDynamic]);

  const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

  const addTile = async () => {
    const title = window.prompt('Titre de la nouvelle tuile ?');
    if (!title || !title.trim()) return;
    const slug = slugify(title.trim());
    const key = `dashboard.tile.${slug}-${Date.now().toString().slice(-6)}`;
    try {
      await api.put(`/settings/${encodeURIComponent(key)}`, { title });
      toast.success('Tuile créée');
      await loadDynamic();
    } catch {
      toast.error('Création impossible');
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 className="mt-3">Tuiles du dashboard</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={addTile}>+ Ajouter une tuile</button>
          <a className="btn btn-outline" href="/admin/push-notifications">Notifications Push</a>
        </div>
      </div>

      <div className="grid grid-2 md:grid-1" style={{ marginTop: 12, gap: 12 }}>
        <TileEditor settingKey="dashboard.green_card_schedule" />
        <TileEditor settingKey="dashboard.events" />
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Tuiles supplémentaires</h3>
        {loadingList ? (
          <div>Chargement…</div>
        ) : dynamicTiles.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Aucune tuile supplémentaire.</div>
        ) : (
          <div className="grid grid-2 md:grid-1" style={{ gap: 12 }}>
            {dynamicTiles.map((t) => (
              <TileEditor key={t.key} settingKey={t.key} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

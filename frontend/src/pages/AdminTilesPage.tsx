import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import FilePicker from '../components/FileManager/FilePicker';
import type { PickedFile } from '../components/FileManager/FilePicker';
import { useToast } from '../contexts/toast-context';
import Modal from '../components/Modal';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import RichTextEditor from '../components/RichTextEditor';

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

function TileEditor({ settingKey, onDeleted }: { settingKey: string; onDeleted?: () => void | Promise<void> }) {
  const { t } = useTranslation();
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
  const [deleting, setDeleting] = useState(false);
  const isDynamic = settingKey.startsWith('dashboard.tile.');
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const doDelete = async () => {
    if (!isDynamic) return;
    try {
      setDeleting(true);
      await api.delete(`/settings/${encodeURIComponent(settingKey)}`);
      toast.success('Tuile supprimée');
      setConfirmOpen(false);
      if (onDeleted) await onDeleted();
    } catch {
      toast.error('Suppression impossible');
    } finally {
      setDeleting(false);
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
      {isDynamic && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-danger btn-sm" disabled={deleting} onClick={() => setConfirmOpen(true)}>
            {deleting ? t('admin.tiles.deleting') : t('admin.tiles.delete')}
          </button>
        </div>
      )}
      {loading ? (
        <div>Chargement…</div>
      ) : (
        <>
          <label>
            <div>Titre</div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la tuile" required style={{ width: '100%' }} />
          </label>
          <label>
            <div>Texte</div>
            <RichTextEditor value={content} onChange={setContent} placeholder="Contenu de la tuile…" />
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
                  <input type="text" value={tempPickedFileName} onChange={(e) => setTempPickedFileName(e.target.value)} placeholder="Nom du fichier (Object Storage)" style={{ width: '100%' }} />
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
      {/* Modal de confirmation de suppression */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('admin.tiles.confirm_delete_title')}>
        <div>{t('admin.tiles.confirm_delete_text')}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="btn btn-outline" onClick={() => setConfirmOpen(false)}>{t('admin.tiles.cancel')}</button>
          <button className="btn btn-danger" onClick={doDelete} disabled={deleting}>{deleting ? t('admin.tiles.deleting') : t('admin.tiles.delete')}</button>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminTilesPage() {
  const toast = useToast();
  const [dynamicTiles, setDynamicTiles] = useState<Setting[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  // État pour la modale d'ajout de tuile
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // État pour la modale d'image d'en-tête
  const [headerOpen, setHeaderOpen] = useState(false);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerCurrent, setHeaderCurrent] = useState<{ fileName: string | null; url: string | null }>({ fileName: null, url: null });

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

  // Charge l'image d'en-tête actuelle pour information
  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await api.get('/settings/dashboard.header_image');
        const s = (data?.data?.setting ?? null) as Setting | null;
        setHeaderCurrent({ fileName: s?.mediaFileName ?? null, url: s?.mediaUrl ?? null });
      } catch {
        // silencieux: la clé peut ne pas exister encore
      }
    };
    void run();
  }, []);

  const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  
  // Ouvre la modale d'ajout
  const openAdd = () => {
    setAddTitle('');
    setAddError(null);
    setAddOpen(true);
  };

  // Création via la modale (validation + appel API)
  const submitAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = addTitle.trim();
    if (!title || title.length < 3) {
      setAddError('Le titre doit comporter au moins 3 caractères');
      return;
    }
    const slug = slugify(title);
    const key = `dashboard.tile.${slug}-${Date.now().toString().slice(-6)}`;
    try {
      setAddSaving(true);
      setAddError(null);
      await api.put(`/settings/${encodeURIComponent(key)}`, { title });
      toast.success('Tuile créée');
      setAddOpen(false);
      setAddTitle('');
      await loadDynamic();
    } catch {
      setAddError('Création impossible');
      toast.error('Création impossible');
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 className="mt-3">Gestion page accueil</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={openAdd}>+ Ajouter une tuile</button>
          <button type="button" className="btn btn-outline" onClick={() => { 
            // Réinitialiser la sélection
            if (headerPreview) URL.revokeObjectURL(headerPreview);
            setHeaderFile(null);
            setHeaderPreview(null);
            setHeaderOpen(true); 
          }}>
            Définir l'image d'en-tête
          </button>
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
              <TileEditor key={t.key} settingKey={t.key} onDeleted={loadDynamic} />
            ))}
          </div>
        )}
      </div>

      {/* Modale d'ajout de tuile (remplace window.prompt) */}
      {addOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'grid', placeItems: 'center' }}>
          <div className="tile" style={{ width: 'min(640px, 92vw)', maxHeight: '85vh', overflow: 'auto', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Ajouter une tuile</div>
              <button className="btn btn-outline" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <form onSubmit={submitAdd}>
              <label>
                <div>Titre de la tuile</div>
                <input type="text" placeholder="Ex: Promotion d'automne" value={addTitle} onChange={(e) => setAddTitle(e.target.value)} />
              </label>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                Clé générée: {`dashboard.tile.${slugify(addTitle || 'nouvelle-tuile')}-XXXXXX`}
              </div>
              {addError && <div style={{ color: 'crimson', marginTop: 8 }}>{addError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setAddOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={addSaving}>{addSaving ? 'Création…' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale — Définir l'image d'en-tête du dashboard (upload + aperçu) */}
      {headerOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'grid', placeItems: 'center' }}>
          <div className="tile" style={{ width: 'min(720px, 92vw)', maxHeight: '85vh', overflow: 'auto', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Choisir une image d'en-tête</div>
              <button className="btn btn-outline" onClick={() => setHeaderOpen(false)}>✕</button>
            </div>
            {headerCurrent.fileName ? (
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Actuel: <code>{headerCurrent.fileName}</code> {headerCurrent.url && (<a className="btn" href={headerCurrent.url} target="_blank" rel="noreferrer">Prévisualiser</a>)}
              </div>
            ) : (
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>Aucune image définie pour l'instant.</div>
            )}
            <div>
              <label>
                <div>Choisir un fichier image</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (headerPreview) URL.revokeObjectURL(headerPreview);
                    setHeaderFile(f);
                    setHeaderPreview(f ? URL.createObjectURL(f) : null);
                  }}
                />
              </label>
              {headerPreview && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Aperçu</div>
                  <img src={headerPreview} alt="Aperçu de l'en-tête" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8 }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-outline" onClick={() => setHeaderOpen(false)}>Annuler</button>
              <button
                className="btn btn-primary"
                disabled={headerSaving || !headerFile}
                onClick={async () => {
                  if (!headerFile) return;
                  try {
                    setHeaderSaving(true);
                    // 1) Demander une URL pré-signée
                    const presignRes = await api.post('/files/presign', {
                      mimeType: headerFile.type,
                      size: headerFile.size,
                      originalName: headerFile.name,
                    }, { timeout: 30_000 });
                    const { url, fileName } = presignRes.data?.data as { url: string; fileName: string };

                    // 2) Upload direct vers le stockage
                    await axios.put(url, headerFile, {
                      headers: { 'Content-Type': headerFile.type || 'application/octet-stream' },
                    });

                    // 3) Enregistrer les métadonnées fichier (modèle privé)
                    await api.post('/files/record', {
                      fileName,
                      originalName: headerFile.name,
                      mimeType: headerFile.type,
                      size: headerFile.size,
                    });

                    // 4) Associer au paramètre de configuration du dashboard
                    await api.put(`/settings/${encodeURIComponent('dashboard.header_image')}`, { mediaFileName: fileName });
                    toast.success("Image d'en-tête enregistrée");
                    setHeaderCurrent({ fileName, url: null });
                    if (headerPreview) URL.revokeObjectURL(headerPreview);
                    setHeaderFile(null);
                    setHeaderPreview(null);
                    setHeaderOpen(false);
                  } catch {
                    toast.error("Impossible d'enregistrer l'image d'en-tête");
                  } finally {
                    setHeaderSaving(false);
                  }
                }}
              >
                {headerSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

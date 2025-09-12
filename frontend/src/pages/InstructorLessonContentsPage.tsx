// Page instructeur: gestion des contenus d'une leçon (vidéo/pdf/doc via URL OVH)
// Sécurité: endpoints protégés; aucune URL sensible exposée; pas de secrets en dur.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import FilePicker from '../components/FileManager/FilePicker';
import type { PickedFile } from '../components/FileManager/FilePicker';
import './InstructorLessonContentsPage.css';
import RichTextEditor from '../components/RichTextEditor';
import { useToast } from '../contexts/toast-context';
// ConfirmDialog supprimé: UX demandée = bouton Enregistrer pour la description

// Nouveau: on ne demande plus le type à l'utilisateur; il est déduit du fichier choisi
// Le lien est éditable uniquement sur les contenus déjà créés (pas à la création)
const contentSchema = z.object({
  fileName: z.string().min(1, 'Fichier requis'),
  caption: z.string().max(1000).optional().default(''),
});

type ContentForm = z.infer<typeof contentSchema>;

type BackendContent = {
  _id?: string;
  id?: string;
  contentType: 'image' | 'pdf' | 'mp4';
  fileName: string;
  caption?: string;
  linkUrl?: string;
  url?: string; // URL signée fournie par le backend pour l'affichage
};

type ContentItem = {
  id: string;
  contentType: 'image' | 'pdf' | 'mp4';
  fileName: string;
  caption?: string;
  linkUrl?: string;
  url?: string;
};

const InstructorLessonContentsPage = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Mimes retenus au moment du pick (création/édition) pour déduire le type
  const [createPickedMime, setCreatePickedMime] = useState<string | null>(null);
  const [editPickedMime, setEditPickedMime] = useState<string | null>(null);
  // Brouillon de légende par contenu (édition inline)
  const [captionDraft, setCaptionDraft] = useState<Record<string, string>>({});
  // Brouillon de lien par contenu (édition inline)
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  // Edition locale: on sépare du schéma pour permettre un état vide puis validation via backend si besoin
  const [editVals, setEditVals] = useState<{ fileName: string; caption: string; linkUrl: string }>({ fileName: '', caption: '', linkUrl: '' });
  // plus de modal -> pas d'état d'ouverture

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ContentForm>({
    resolver: zodResolver(contentSchema),
  });

  // -------------------- Sauvegarde locale des brouillons (backup) --------------------
  const storageKey = (id?: string) => `contents-caption-drafts:${id ?? ''}`;
  const storageKeyLink = (id?: string) => `contents-link-drafts:${id ?? ''}`;
  const loadBackupDrafts = (): Record<string, string> => {
    try {
      if (!lessonId) return {};
      const raw = localStorage.getItem(storageKey(lessonId));
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  };
  const saveBackupDrafts = (drafts: Record<string, string>) => {
    try {
      if (!lessonId) return;
      localStorage.setItem(storageKey(lessonId), JSON.stringify(drafts));
    } catch {
      // ignore quota errors
    }
  };
  const loadBackupLinkDrafts = (): Record<string, string> => {
    try {
      if (!lessonId) return {};
      const raw = localStorage.getItem(storageKeyLink(lessonId));
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  };
  const saveBackupLinkDrafts = (drafts: Record<string, string>) => {
    try {
      if (!lessonId) return;
      localStorage.setItem(storageKeyLink(lessonId), JSON.stringify(drafts));
    } catch {
      // ignore quota errors
    }
  };

  const loadContents = async () => {
    if (!lessonId) return;
    try {
      setError(null);
      const { data } = await api.get(`/lessons/${lessonId}/contents`);
      const arr = Array.isArray(data?.data) ? (data.data as BackendContent[]) : [];
      const mapped: ContentItem[] = arr.map((c) => ({
        id: c._id ?? c.id ?? '',
        contentType: c.contentType,
        fileName: c.fileName,
        caption: c.caption ?? '',
        linkUrl: c.linkUrl ?? '',
        url: c.url,
      })).filter((c) => !!c.id);
      setContents(mapped);
      // Init des brouillons: fusion backup local -> prioritaire s'il existe (pour ne pas perdre une saisie en cours)
      const serverDraft: Record<string, string> = {};
      for (const c of mapped) serverDraft[c.id] = c.caption ?? '';
      const backup = loadBackupDrafts();
      const merged: Record<string, string> = { ...serverDraft, ...backup };
      setCaptionDraft(merged);
      saveBackupDrafts(merged);
      // Idem pour les liens
      const serverLinkDraft: Record<string, string> = {};
      for (const c of mapped) serverLinkDraft[c.id] = c.linkUrl ?? '';
      const backupLink = loadBackupLinkDrafts();
      const mergedLink: Record<string, string> = { ...serverLinkDraft, ...backupLink };
      setLinkDraft(mergedLink);
      saveBackupLinkDrafts(mergedLink);
    } catch (err: unknown) {
      const fallback = 'Erreur lors du chargement des contenus';
      if (isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message;
        setError(msg ?? fallback);
      } else {
        setError(fallback);
      }
    }
  };

  // Gestion de la sélection depuis le FilePicker (création): on stocke la clé fileName dans le formulaire
  const deriveTypeFromMimeOrName = (mime?: string | null, name?: string): 'image' | 'pdf' | 'mp4' => {
    const n = (name || '').toLowerCase();
    const m = (mime || '').toLowerCase();
    if (m === 'video/mp4' || n.endsWith('.mp4')) return 'mp4';
    if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    return 'image';
  };

  const handlePickedForCreate = async (file: PickedFile) => {
    setCreatePickedMime(file.mimeType || null);
    setValue('fileName', file.fileName, { shouldDirty: true, shouldValidate: true });
  };

  const handlePickedForEdit = async (file: PickedFile) => {
    setEditPickedMime(file.mimeType || null);
    setEditVals((v) => ({ ...v, fileName: file.fileName }));
  };

  useEffect(() => {
    setLoading(true);
    loadContents().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const onSubmit = async (values: ContentForm) => {
    if (!lessonId) return;
    try {
      setSubmitting(true);
      // Déduire le type automatiquement
      const contentType = deriveTypeFromMimeOrName(createPickedMime, values.fileName);
      await api.post(`/lessons/${lessonId}/contents`, { ...values, contentType });
      await loadContents();
      reset();
      setCreatePickedMime(null);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de créer le contenu');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c: ContentItem) => {
    setEditingId(c.id);
    setEditVals({ fileName: c.fileName, caption: c.caption ?? '', linkUrl: c.linkUrl ?? '' });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      if (!editVals.fileName) {
        alert('Veuillez sélectionner un fichier');
        return;
      }
      const contentType = deriveTypeFromMimeOrName(editPickedMime, editVals.fileName);
      await api.put(`/contents/${editingId}`, { contentType, fileName: editVals.fileName, caption: editVals.caption ?? '', linkUrl: editVals.linkUrl ?? '' });
      await loadContents();
      setEditingId(null);
      setEditPickedMime(null);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Mise à jour impossible');
    }
  };

  const saveCaption = async (c: ContentItem) => {
    try {
      setSavingId(c.id);
      const newCaption = captionDraft[c.id] ?? '';
      const newLink = linkDraft[c.id] ?? '';
      // On envoie les champs nécessaires pour une mise à jour complète (incl. lien)
      await api.put(`/contents/${c.id}`, { contentType: c.contentType, fileName: c.fileName, caption: newCaption, linkUrl: newLink });
      await loadContents();
      // Nettoyer le backup pour cet élément (il est désormais enregistré)
      setCaptionDraft((prev) => {
        const next = { ...prev };
        next[c.id] = newCaption; // garder la valeur à jour
        saveBackupDrafts(next);
        return next;
      });
      setLinkDraft((prev) => {
        const next = { ...prev };
        next[c.id] = newLink;
        saveBackupLinkDrafts(next);
        return next;
      });
      toast.success('Contenu enregistré');
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Enregistrement impossible');
    } finally {
      setSavingId(null);
    }
  };

  const hasContents = useMemo(() => contents.length > 0, [contents.length]);

  if (loading) return <div>Chargement des contenus…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div className="container">
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>← Retour</button>
        {/* Modal/FilePicker supprimé ici; FilePicker inline conservé */}
      </div>
      <h2>Contenus de la leçon</h2>

      <section style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Ajouter un contenu</h3>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
            <label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Fichier</span>
              </div>
              <input type="text" placeholder="Aucun fichier sélectionné" readOnly {...register('fileName')} />
              {errors.fileName && <div style={{ color: 'crimson' }}>{errors.fileName.message}</div>}
              {/* FilePicker en ligne */}
              <div style={{ marginTop: 8 }}>
                <FilePicker mode="inline" onSelect={handlePickedForCreate} />
              </div>
            </label>
            <div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Ajout…' : '+ Ajouter'}</button>
            </div>
          </div>
        </form>
      </section>

      <section>
        {!hasContents ? (
          <div>Aucun contenu pour le moment.</div>
        ) : (
          <ul style={{ padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
            {contents.map((c) => (
              <li key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
                {editingId === c.id ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>Fichier</span>
                      </div>
                      <input type="text" value={editVals.fileName} onChange={(e) => setEditVals((v) => ({ ...v, fileName: e.target.value }))} />
                      <div style={{ marginTop: 8 }}>
                        <FilePicker mode="inline" onSelect={handlePickedForEdit} />
                      </div>
                    </label>
                    <label>
                      <div>Légende (optionnel)</div>
                      <RichTextEditor value={editVals.caption} onChange={(val) => setEditVals((v) => ({ ...v, caption: val }))} placeholder="Légende…" />
                    </label>
                    <label>
                      <div>Lien (URL de redirection — optionnel)</div>
                      <input type="url" value={editVals.linkUrl} onChange={(e) => setEditVals((v) => ({ ...v, linkUrl: e.target.value }))} placeholder="https://exemple.com ou mailto:..." />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={saveEdit}>Sauvegarder</button>
                      <button type="button" onClick={cancelEdit}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="mediaRow" style={{ display: 'grid', gap: 12 }}>
                    <div className="media">
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontWeight: 600 }}>{c.contentType.toUpperCase()}</div>
                        <div style={{ fontSize: 14, color: '#475569' }}>{c.fileName}</div>
                      </div>
                      <div>
                        {c.url ? (
                          c.contentType === 'image' ? (
                            c.linkUrl ? (
                              <a href={c.linkUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                <img src={c.url} alt={c.fileName} style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6 }} />
                              </a>
                            ) : (
                              <img src={c.url} alt={c.fileName} style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6 }} />
                            )
                          ) : c.contentType === 'mp4' ? (
                            c.linkUrl ? (
                              <a href={c.linkUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                <video src={c.url} controls style={{ width: '100%', maxHeight: 420, border: '1px solid #e5e7eb', borderRadius: 6 }} />
                              </a>
                            ) : (
                              <video src={c.url} controls style={{ width: '100%', maxHeight: 420, border: '1px solid #e5e7eb', borderRadius: 6 }} />
                            )
                          ) : (
                            // PDF inline via iframe (on ne wrap pas dans un lien car déjà cliquable)
                            <iframe title={c.fileName} src={c.url} style={{ width: '100%', height: 500, border: '1px solid #e5e7eb', borderRadius: 6 }} />
                          )
                        ) : (
                          <div style={{ color: '#64748b', fontStyle: 'italic' }}>URL non disponible</div>
                        )}
                      </div>
                    </div>
                    <div className="caption">
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Description</div>
                      <RichTextEditor
                        value={captionDraft[c.id] ?? ''}
                        onChange={(val) => setCaptionDraft((m) => {
                          const next = { ...m, [c.id]: val };
                          saveBackupDrafts(next);
                          return next;
                        })}
                        placeholder="Ajouter une description…"
                      />
                      <div style={{ marginTop: 8 }}>
                        <label>
                          <div>Lien (URL de redirection — optionnel)</div>
                          <input
                            type="url"
                            value={linkDraft[c.id] ?? ''}
                            placeholder="https://exemple.com ou mailto:..."
                            onChange={(e) => setLinkDraft((prev) => {
                              const next = { ...prev, [c.id]: e.target.value };
                              saveBackupLinkDrafts(next);
                              return next;
                            })}
                            style={{ width: '100%' }}
                          />
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            Renseignez une URL pour rendre le contenu cliquable.
                          </div>
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => saveCaption(c)}
                          disabled={savingId === c.id}
                        >
                          {savingId === c.id ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => startEdit(c)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={async () => {
                            if (!window.confirm('Supprimer ce contenu ?')) return;
                            try {
                              setSavingId(c.id);
                              await api.delete(`/contents/${c.id}`);
                              await loadContents();
                            } catch (err) {
                              const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
                              alert(msg ?? 'Suppression impossible');
                            } finally {
                              setSavingId(null);
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default InstructorLessonContentsPage;

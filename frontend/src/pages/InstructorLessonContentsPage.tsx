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
import ConfirmDialog from '../components/ConfirmDialog';

const contentSchema = z.object({
  // Pas de type par défaut: l'utilisateur doit choisir explicitement
  contentType: z.enum(['image', 'pdf', 'mp4'], { required_error: 'Type requis' }),
  // On envoie désormais la clé interne du fichier
  fileName: z.string().min(1, 'Fichier requis'),
  // Légende/description optionnelle
  caption: z.string().max(1000).optional().default(''),
});

type ContentForm = z.infer<typeof contentSchema>;

type BackendContent = {
  _id?: string;
  id?: string;
  contentType: 'image' | 'pdf' | 'mp4';
  fileName: string;
  caption?: string;
  url?: string; // URL signée fournie par le backend pour l'affichage
};

type ContentItem = {
  id: string;
  contentType: 'image' | 'pdf' | 'mp4';
  fileName: string;
  caption?: string;
  url?: string;
};

const InstructorLessonContentsPage = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Edition locale: on sépare du schéma pour permettre un état vide puis validation via backend si besoin
  const [editVals, setEditVals] = useState<{ contentType: ContentForm['contentType'] | ''; fileName: string; caption: string }>({ contentType: '', fileName: '', caption: '' });
  // plus de modal -> pas d'état d'ouverture

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ContentForm>({
    resolver: zodResolver(contentSchema),
  });

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
        url: c.url,
      })).filter((c) => !!c.id);
      setContents(mapped);
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
  const handlePickedForCreate = async (file: PickedFile) => {
    setValue('fileName', file.fileName, { shouldDirty: true, shouldValidate: true });
  };

  const handlePickedForEdit = async (file: PickedFile) => {
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
      await api.post(`/lessons/${lessonId}/contents`, values);
      await loadContents();
      reset();
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de créer le contenu');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c: ContentItem) => {
    setEditingId(c.id);
    setEditVals({ contentType: c.contentType, fileName: c.fileName, caption: c.caption ?? '' });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      // Validation basique: exiger un type et un fileName non vides
      if (!editVals.contentType || !editVals.fileName) {
        alert('Veuillez sélectionner un type et un fichier');
        return;
      }
      await api.put(`/contents/${editingId}`, { contentType: editVals.contentType, fileName: editVals.fileName, caption: editVals.caption ?? '' });
      await loadContents();
      setEditingId(null);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Mise à jour impossible');
    }
  };

  const onDeleteClick = (id: string, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      setDeletingId(pendingDeleteId);
      await api.delete(`/contents/${pendingDeleteId}`);
      await loadContents();
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Suppression impossible');
    } finally {
      setDeletingId(null);
      setConfirmOpen(false);
      setPendingDeleteId(null);
    }
  };

  const hasContents = useMemo(() => contents.length > 0, [contents.length]);

  if (loading) return <div>Chargement des contenus…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => navigate(-1)}>← Retour</button>
        {/* Modal FilePicker - réutilisé pour create/edit */}
      {/* supprimé: modal picker */}
      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer le contenu"
        message={<span>Cette action est irréversible. Confirmer la suppression ?</span>}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={performDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
      />
    </div>
      <h2>Contenus de la leçon</h2>

      <section style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Ajouter un contenu</h3>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
            <label>
              <div>Type</div>
              <select defaultValue="" {...register('contentType')}>
                <option value="" disabled>-- Sélectionner --</option>
                <option value="image">Image</option>
                <option value="pdf">PDF</option>
                <option value="mp4">MP4</option>
              </select>
            </label>
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
            {/* Légende supprimée à la création: editable après attachement via le mode édition */}
            <div>
              <button type="submit" disabled={submitting}>{submitting ? 'Ajout…' : '+ Ajouter'}</button>
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
                      <div>Type</div>
                      <select value={editVals.contentType} onChange={(e) => setEditVals((v) => ({ ...v, contentType: e.target.value as ContentForm['contentType'] }))}>
                        <option value="image">Image</option>
                        <option value="pdf">PDF</option>
                        <option value="mp4">MP4</option>
                      </select>
                    </label>
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
                      <textarea rows={3} value={editVals.caption} onChange={(e) => setEditVals((v) => ({ ...v, caption: e.target.value }))} />
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
                            <img src={c.url} alt={c.fileName} style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6 }} />
                          ) : c.contentType === 'mp4' ? (
                            <video src={c.url} controls style={{ width: '100%', maxHeight: 420, border: '1px solid #e5e7eb', borderRadius: 6 }} />
                          ) : (
                            // PDF inline via iframe
                            <iframe title={c.fileName} src={c.url} style={{ width: '100%', height: 500, border: '1px solid #e5e7eb', borderRadius: 6 }} />
                          )
                        ) : (
                          <div style={{ color: '#64748b', fontStyle: 'italic' }}>URL non disponible</div>
                        )}
                      </div>
                    </div>
                    <div className="caption">
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Description</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{(c.caption ?? '').trim() || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Aucune description</span>}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
                      <button type="button" onClick={() => startEdit(c)}>Modifier</button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        onMouseDownCapture={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStartCapture={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        onClick={(e) => onDeleteClick(c.id, e)}
                        disabled={deletingId === c.id}
                      >
                        {deletingId === c.id ? 'Suppression…' : 'Supprimer'}
                      </button>
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

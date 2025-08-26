// Page instructeur: gestion des contenus d'une leçon (vidéo/pdf/doc via URL OVH)
// Sécurité: endpoints protégés; aucune URL sensible exposée; pas de secrets en dur.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const contentSchema = z.object({
  contentType: z.enum(['video', 'pdf', 'doc']),
  url: z.string().url('URL invalide (https://...)'),
});

type ContentForm = z.infer<typeof contentSchema>;

type BackendContent = {
  _id?: string;
  id?: string;
  contentType: 'video' | 'pdf' | 'doc';
  url: string;
};

type ContentItem = {
  id: string;
  contentType: 'video' | 'pdf' | 'doc';
  url: string;
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
  const [editVals, setEditVals] = useState<ContentForm>({ contentType: 'video', url: '' });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContentForm>({
    resolver: zodResolver(contentSchema),
    defaultValues: { contentType: 'video', url: '' },
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
      reset({ contentType: 'video', url: '' });
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de créer le contenu');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c: ContentItem) => {
    setEditingId(c.id);
    setEditVals({ contentType: c.contentType, url: c.url });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await api.put(`/contents/${editingId}`, editVals);
      await loadContents();
      setEditingId(null);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Mise à jour impossible');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Supprimer ce contenu ?')) return;
    try {
      setDeletingId(id);
      await api.delete(`/contents/${id}`);
      await loadContents();
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Suppression impossible');
    } finally {
      setDeletingId(null);
    }
  };

  const hasContents = useMemo(() => contents.length > 0, [contents.length]);

  if (loading) return <div>Chargement des contenus…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => navigate(-1)}>← Retour</button>
      </div>
      <h2>Contenus de la leçon</h2>

      <section style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Ajouter un contenu</h3>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
            <label>
              <div>Type</div>
              <select {...register('contentType')}>
                <option value="video">Vidéo</option>
                <option value="pdf">PDF</option>
                <option value="doc">Document</option>
              </select>
            </label>
            <label>
              <div>URL (OVH Object Storage)</div>
              <input type="url" placeholder="https://..." {...register('url')} />
              {errors.url && <div style={{ color: 'crimson' }}>{errors.url.message}</div>}
            </label>
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
                        <option value="video">Vidéo</option>
                        <option value="pdf">PDF</option>
                        <option value="doc">Document</option>
                      </select>
                    </label>
                    <label>
                      <div>URL</div>
                      <input type="url" value={editVals.url} onChange={(e) => setEditVals((v) => ({ ...v, url: e.target.value }))} />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={saveEdit}>Sauvegarder</button>
                      <button type="button" onClick={cancelEdit}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.contentType.toUpperCase()}</div>
                      <div style={{ fontSize: 14, color: '#475569' }}>
                        <a href={c.url} target="_blank" rel="noreferrer">{c.url}</a>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => startEdit(c)}>Modifier</button>
                      <button type="button" className="btn btn-danger" onClick={() => onDelete(c.id)} disabled={deletingId === c.id}>{deletingId === c.id ? 'Suppression…' : 'Supprimer'}</button>
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

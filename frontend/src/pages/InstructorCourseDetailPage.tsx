// Page instructeur: gestion des leçons d'un module (cours)
// Sécurité: endpoints protégés par JWT; RBAC côté backend (instructor/admin).
// Règles: titres en Title Case; ordre modifiable; modes read/pro/qcm; description optionnelle.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const lessonSchema = z.object({
  title: z.string().min(3, 'Titre trop court'),
  order: z.coerce.number().int().positive('Doit être > 0'),
  validationMode: z.enum(['read', 'pro', 'qcm']).default('read'),
  description: z.string().optional(),
});

type LessonForm = z.infer<typeof lessonSchema>;

type BackendLesson = {
  _id?: string;
  id?: string;
  title: string;
  order: number;
  validationMode: 'read' | 'pro' | 'qcm';
  description?: string;
};

type Lesson = {
  id: string;
  title: string;
  order: number;
  validationMode: 'read' | 'pro' | 'qcm';
  description?: string;
};

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

const InstructorCourseDetailPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<LessonForm>({ title: '', order: 1, validationMode: 'read', description: '' });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LessonForm>({
    resolver: zodResolver(lessonSchema),
    defaultValues: { title: '', order: 1, validationMode: 'read', description: '' },
  });

  const loadLessons = async () => {
    if (!courseId) return;
    try {
      setError(null);
      const { data } = await api.get(`/courses/${courseId}/lessons`);
      const arr = Array.isArray(data?.data) ? (data.data as BackendLesson[]) : [];
      const mapped: Lesson[] = arr.map((l) => ({
        id: l._id ?? l.id ?? '',
        title: l.title,
        order: l.order,
        validationMode: l.validationMode,
        description: l.description,
      })).filter((l) => !!l.id);
      setLessons(mapped);
    } catch (err: unknown) {
      const fallback = 'Erreur lors du chargement des leçons';
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
    loadLessons().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const onSubmit = async (values: LessonForm) => {
    if (!courseId) return;
    try {
      setSubmitting(true);
      const payload = { ...values, title: toTitleCase(values.title) };
      await api.post(`/courses/${courseId}/lessons`, payload);
      await loadLessons();
      reset({ title: '', order: 1, validationMode: 'read', description: '' });
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de créer la leçon');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (l: Lesson) => {
    setEditingId(l.id);
    setEditVals({ title: l.title, order: l.order, validationMode: l.validationMode, description: l.description ?? '' });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const payload = { ...editVals, title: toTitleCase(editVals.title) };
      await api.put(`/lessons/${editingId}`, payload);
      await loadLessons();
      setEditingId(null);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Mise à jour impossible');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Supprimer cette leçon ?')) return;
    try {
      setDeletingId(id);
      await api.delete(`/lessons/${id}`);
      await loadLessons();
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Suppression impossible');
    } finally {
      setDeletingId(null);
    }
  };

  const sorted = useMemo(() => [...lessons].sort((a, b) => a.order - b.order), [lessons]);

  if (loading) return <div>Chargement des leçons…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/instructor/courses">← Retour aux modules</Link>
      </div>
      <h2>Leçons du module</h2>

      <section style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Créer une leçon</h3>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
            <label>
              <div>Titre</div>
              <input type="text" placeholder="Ex: Posture de base" {...register('title')} />
              {errors.title && <div style={{ color: 'crimson' }}>{errors.title.message}</div>}
            </label>
            <label>
              <div>Ordre</div>
              <input type="number" min={1} step={1} {...register('order', { valueAsNumber: true })} />
              {errors.order && <div style={{ color: 'crimson' }}>{errors.order.message}</div>}
            </label>
            <label>
              <div>Mode de validation</div>
              <select {...register('validationMode')}>
                <option value="read">Lecture</option>
                <option value="pro">Pro</option>
                <option value="qcm">QCM</option>
              </select>
            </label>
            <label>
              <div>Description</div>
              <textarea rows={3} placeholder="Texte/HTML d'explication (affiché dans la modale joueur)" {...register('description')} />
            </label>
            <div>
              <button type="submit" disabled={submitting}>{submitting ? 'Création…' : '+ Créer la leçon'}</button>
            </div>
          </div>
        </form>
      </section>

      <section>
        {sorted.length === 0 ? (
          <div>Aucune leçon pour le moment.</div>
        ) : (
          <ul style={{ padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
            {sorted.map((l) => (
              <li key={l.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
                {editingId === l.id ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label>
                      <div>Titre</div>
                      <input type="text" value={editVals.title} onChange={(e) => setEditVals((v) => ({ ...v, title: e.target.value }))} />
                    </label>
                    <label>
                      <div>Ordre</div>
                      <input type="number" min={1} step={1} value={editVals.order} onChange={(e) => setEditVals((v) => ({ ...v, order: Number(e.target.value) }))} />
                    </label>
                    <label>
                      <div>Mode de validation</div>
                      <select value={editVals.validationMode} onChange={(e) => setEditVals((v) => ({ ...v, validationMode: e.target.value as LessonForm['validationMode'] }))}>
                        <option value="read">Lecture</option>
                        <option value="pro">Pro</option>
                        <option value="qcm">QCM</option>
                      </select>
                    </label>
                    <label>
                      <div>Description</div>
                      <textarea rows={3} value={editVals.description ?? ''} onChange={(e) => setEditVals((v) => ({ ...v, description: e.target.value }))} />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={saveEdit}>Sauvegarder</button>
                      <button type="button" onClick={cancelEdit}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>#{l.order} — {l.title}</div>
                      <div style={{ fontSize: 14, color: '#475569' }}>Mode: {l.validationMode}</div>
                      {l.description && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{l.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to={`/instructor/lessons/${l.id}/contents`}>Contenus</Link>
                      <button type="button" onClick={() => startEdit(l)}>Modifier</button>
                      <button type="button" onClick={() => onDelete(l.id)} disabled={deletingId === l.id}>{deletingId === l.id ? 'Suppression…' : 'Supprimer'}</button>
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

export default InstructorCourseDetailPage;

// Page instructeur: gestion des leçons d'un module (cours)
// Sécurité: endpoints protégés par JWT; RBAC côté backend (instructor/admin).
// Règles: titres en Title Case; ordre modifiable; modes read/pro/qcm; description optionnelle.
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderLessons as reorderLessonsApi } from '../services/lessons';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './InstructorCourseDetailPage.module.css';
import RichTextEditor from '../components/RichTextEditor';
import { toSafeHtml } from '../utils/sanitize';

// Schéma de création: l'ordre est géré automatiquement côté backend (append en fin)
const lessonSchema = z.object({
  title: z.string().min(3, 'Titre trop court'),
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
  const [editVals, setEditVals] = useState<LessonForm>({ title: '', validationMode: 'read', description: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // dnd-kit sensors: n'activer le drag qu'après un léger déplacement pour laisser passer les clics
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<LessonForm>({
    resolver: zodResolver(lessonSchema),
    defaultValues: { title: '', validationMode: 'read', description: '' },
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
      // Assurer l'ordre initial par valeur d'ordre
      setLessons(mapped.sort((a, b) => a.order - b.order));
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

  // Bloque DnD sur les actions (sans empêcher le clic)
  const stopForDnD = (e: React.SyntheticEvent) => {
    e.stopPropagation();
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
      reset({ title: '', validationMode: 'read', description: '' });
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de créer la leçon');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (l: Lesson) => {
    setEditingId(l.id);
    setEditVals({ title: l.title, validationMode: l.validationMode, description: l.description ?? '' });
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

  // DnD handlers: réordonnancement optimiste puis persistance API
  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lessons.findIndex((l) => l.id === String(active.id));
    const newIndex = lessons.findIndex((l) => l.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newArr = arrayMove(lessons, oldIndex, newIndex);
    setLessons(newArr);
    if (!courseId) return;
    try {
      await reorderLessonsApi(courseId, newArr.map((l) => l.id));
      // Rechargement pour récupérer les ordres numériques mis à jour
      await loadLessons();
    } catch (err: unknown) {
      // rollback: recharger depuis le serveur
      await loadLessons();
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Réordonnancement impossible');
    }
  };

  // Élément triable
  function SortableItem({ l }: { l: Lesson }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: l.id, disabled: editingId === l.id });
    const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
    return (
      <li ref={setNodeRef} className={`tile ${styles.item}`} style={style}>
        {editingId === l.id ? (
          <div className={styles.formGrid}>
            <label>
              <div>Titre</div>
              <input type="text" value={editVals.title} onChange={(e) => setEditVals((v) => ({ ...v, title: e.target.value }))} />
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
              <RichTextEditor value={editVals.description ?? ''} onChange={(val) => setEditVals((v) => ({ ...v, description: val }))} minHeight={220} />
            </label>
            <div className={styles.actions}>
              <button type="button" className="btn btn-primary" onClick={saveEdit}>Sauvegarder</button>
              <button type="button" className="btn btn-outline" onClick={cancelEdit}>Annuler</button>
            </div>
          </div>
        ) : (
          <div className={styles.itemRow}>
            <div className={styles.left}>
              <div className={styles.name}>#{l.order} — {l.title}</div>
              <div><span className="badge badge-mode">{l.validationMode.toUpperCase()}</span></div>
              {l.description && <div className={styles.desc} dangerouslySetInnerHTML={{ __html: toSafeHtml(l.description) }} />}
            </div>
            <div className={styles.actions}>
              <span
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                aria-label="Glisser pour réordonner"
                title="Glisser pour réordonner"
                className={styles.handle}
              >
                ⋮⋮
              </span>
              <div
                onPointerDownCapture={stopForDnD}
                onMouseDownCapture={stopForDnD}
                onDragStart={(e) => e.preventDefault()}
                className={styles.actions}
                draggable={false}
              >
                <Link to={`/instructor/lessons/${l.id}/contents`}>Contenus</Link>
                {l.validationMode === 'qcm' && (
                  <Link to={`/instructor/lessons/${l.id}/quiz`}>QCM</Link>
                )}
                <button type="button" className="btn btn-outline" onClick={() => startEdit(l)}>Modifier</button>
                <button
                  type="button"
                  onPointerDownCapture={stopForDnD}
                  onMouseDownCapture={stopForDnD}
                  onPointerDown={stopForDnD}
                  onMouseDown={stopForDnD}
                  onClick={(e) => { e.stopPropagation(); setPendingDeleteId(l.id); setConfirmOpen(true); }}
                  className="btn btn-danger"
                  disabled={deletingId === l.id}
                  draggable={false}
                >
                  {deletingId === l.id ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </li>
    );
  }

  const performDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      setDeletingId(pendingDeleteId);
      await api.delete(`/lessons/${pendingDeleteId}`);
      await loadLessons();
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Suppression impossible');
    } finally {
      setDeletingId(null);
      setConfirmOpen(false);
      setPendingDeleteId(null);
    }
  };

  if (loading) return <div>Chargement des leçons…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/instructor/courses">← Retour aux modules</Link>
        <h2>Leçons du module</h2>
      </div>

      <section className={`card ${styles.formCard}`}>
        <h3 style={{ marginTop: 0 }}>Créer une leçon</h3>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.formGrid}>
            <label>
              <div>Titre</div>
              <input type="text" placeholder="" {...register('title')} />
              {errors.title && <div style={{ color: 'crimson' }}>{errors.title.message}</div>}
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
              <RichTextEditor
                value={watch('description') || ''}
                onChange={(val) => setValue('description', val, { shouldDirty: true })}
                minHeight={220}
              />
            </label>
            <div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Création…' : '+ Créer la leçon'}</button>
            </div>
          </div>
        </form>
      </section>

      <section>
        {lessons.length === 0 ? (
          <div>Aucune leçon pour le moment.</div>
        ) : (
          <>
          <div className={styles.hint}>Astuce: utilisez l'icône « ⋮⋮ » pour glisser-déposer et réordonner les leçons.</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={lessons.filter((l) => l.id !== editingId).map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <ul className={styles.list}>
                {lessons.map((l) => (
                  l.id === editingId ? (
                    <li key={l.id} className={`tile ${styles.item}`}>
                      <div className={styles.formGrid}>
                        <label>
                          <div>Titre</div>
                          <input type="text" value={editVals.title} onChange={(e) => setEditVals((v) => ({ ...v, title: e.target.value }))} />
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
                          <RichTextEditor value={editVals.description ?? ''} onChange={(val) => setEditVals((v) => ({ ...v, description: val }))} minHeight={220} />
                        </label>
                        <div className={styles.actions}>
                          <button type="button" className="btn btn-primary" onClick={saveEdit}>Sauvegarder</button>
                          <button type="button" className="btn btn-outline" onClick={cancelEdit}>Annuler</button>
                        </div>
                      </div>
                    </li>
                  ) : (
                    <SortableItem key={l.id} l={l} />
                  )
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          </>
        )}
      </section>
      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer la leçon"
        message={<span>Cette action est irréversible. Confirmer la suppression ?</span>}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={performDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
      />
    </div>
  );
};

export default InstructorCourseDetailPage;

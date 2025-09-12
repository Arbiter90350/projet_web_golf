// Page instructeur (et admin) pour gérer les cours (modules)
// Sécurité: appels protégés par JWT via l'intercepteur d'`api`.
// Bonnes pratiques: validations basiques côté UI; messages en français; pas de données sensibles dans les logs.
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '../contexts/toast-context';
import RichTextEditor from '../components/RichTextEditor';
import { toSafeHtml } from '../utils/sanitize';

type BackendCourse = {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  isPublished?: boolean;
};

type Course = {
  id: string;
  title: string;
  description: string;
  isPublished: boolean;
};

const courseSchema = z.object({
  title: z.string().min(3, 'Titre trop court').max(100, 'Titre trop long'),
  description: z.string().min(10, 'Description trop courte'),
  isPublished: z.boolean().optional().default(false),
});

type CourseForm = z.infer<typeof courseSchema>;

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

type SortableCourseRowProps = {
  course: Course;
  deletingId: string | null;
  onEdit: (c: Course) => void;
  onDeleteClick: (id: string) => void;
};

function SortableCourseRow({ course, deletingId, onEdit, onDeleteClick }: SortableCourseRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
    boxShadow: isDragging ? '0 12px 28px rgba(0,0,0,0.14)' : undefined,
    background: isDragging ? '#fff' : undefined,
  };

  return (
    <li ref={setNodeRef} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', ...style }} className="tile">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 260 }}>
          <button
            aria-label={t('instructor.courses.reorder_handle')}
            {...attributes}
            {...listeners}
            style={{ cursor: 'grab', border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 6, padding: '0.25rem 0.4rem' }}
            className="btn btn-outline"
          >
            ⋮⋮
          </button>
          <div>
            <div style={{ fontWeight: 600 }}>{course.title}</div>
            <div style={{ fontSize: 14, color: '#475569' }} dangerouslySetInnerHTML={{ __html: toSafeHtml(course.description) }} />
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {t('instructor.courses.status_label')}: {course.isPublished ? t('instructor.courses.status_published') : t('instructor.courses.status_draft')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/instructor/courses/${course.id}`} className="btn btn-outline">{t('instructor.courses.manage_lessons')}</Link>
          <button type="button" onClick={() => onEdit(course)} className="btn btn-outline">{t('instructor.courses.edit')}</button>
          <button type="button" onClick={() => onDeleteClick(course.id)} disabled={deletingId === course.id} className="btn btn-danger">
            {deletingId === course.id ? t('instructor.courses.deleting') : t('instructor.courses.delete')}
          </button>
        </div>
      </div>
    </li>
  );
}

const InstructorCoursesPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{ title: string; description: string; isPublished: boolean }>({ title: '', description: '', isPublished: false });
  // Modales: création, édition, suppression
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: '', description: '', isPublished: false },
  });

  const [reorderSaving, setReorderSaving] = useState(false);

  const loadCourses = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get('/courses');
      const arr = Array.isArray(data?.data) ? (data.data as BackendCourse[]) : [];
      const mapped: Course[] = arr
        .map((c) => ({
          id: c._id ?? c.id ?? '',
          title: c.title,
          description: c.description,
          isPublished: !!c.isPublished,
        }))
        .filter((c) => !!c.id);
      setCourses(mapped);
    } catch (err: unknown) {
      const fallback = t('instructor.courses.error_loading');
      if (isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message;
        setError(msg ?? fallback);
      } else {
        setError(fallback);
      }
    }
  }, [t]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const prev = courses;
    const oldIndex = prev.findIndex((c) => c.id === active.id);
    const newIndex = prev.findIndex((c) => c.id === over.id);
    const nextArr: Course[] = arrayMove(prev, oldIndex, newIndex);
    setCourses(nextArr);
    setReorderSaving(true);
    try {
      await api.put('/courses/reorder', { ids: nextArr.map((c: Course) => c.id) });
      // Afficher une confirmation non bloquante (toast) lorsque l'ordre est enregistré côté serveur
      toast.success(t('instructor.courses.reorder_success'));
    } catch (err) {
      // revert UI on failure
      setCourses(prev);
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      toast.error(msg ?? t('instructor.courses.reorder_failed'));
    } finally {
      setReorderSaving(false);
    }
  };

  const startEdit = (c: Course) => {
    setEditingId(c.id);
    setEditVals({ title: c.title, description: c.description, isPublished: c.isPublished });
    setShowEditModal(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowEditModal(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const payload = { ...editVals, title: toTitleCase(editVals.title) };
      await api.put(`/courses/${editingId}`, payload);
      await loadCourses();
      setEditingId(null);
      setShowEditModal(false);
    } catch (err: unknown) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      alert(msg ?? t('instructor.courses.update_failed'));
    }
  };

  useEffect(() => {
    setLoading(true);
    loadCourses().finally(() => setLoading(false));
  }, [loadCourses]);

  const onSubmit = async (values: CourseForm) => {
    try {
      setSubmitting(true);
      const payload = { ...values, title: toTitleCase(values.title) };
      await api.post('/courses', payload);
      await loadCourses();
      reset({ title: '', description: '', isPublished: false });
      setShowCreateModal(false);
    } catch (err: unknown) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      alert(msg ?? t('instructor.courses.create_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await api.delete(`/courses/${id}`);
      await loadCourses();
    } catch (err: unknown) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      alert(msg ?? t('instructor.courses.delete_failed'));
    } finally {
      setDeletingId(null);
      setShowDeleteModal({ open: false, id: null });
    }
  };

  const hasCourses = useMemo(() => courses.length > 0, [courses.length]);

  if (loading) return <div>{t('instructor.courses.loading')}</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t('instructor.courses.title')}</h2>
        <div className="badge badge-mode" aria-live="polite">{reorderSaving ? t('instructor.courses.reorder_saving') : t('instructor.courses.reorder_hint')}</div>
      </div>

      <div style={{ margin: '1rem 0' }}>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>{t('instructor.courses.create_button')}</button>
      </div>

      <section>
        {!hasCourses ? (
          <div>{t('instructor.courses.list_empty')}</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={courses.map((c: Course) => c.id)} strategy={verticalListSortingStrategy}>
              <ul style={{ padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
                {courses.map((c: Course) => (
                  <SortableCourseRow
                    key={c.id}
                    course={c}
                    deletingId={deletingId}
                    onEdit={startEdit}
                    onDeleteClick={(id) => setShowDeleteModal({ open: true, id })}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* Modale — Créer un module */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, width: 'min(90vw, 640px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{t('instructor.courses.modal_create_title')}</h3>
              <button onClick={() => { setShowCreateModal(false); }}>×</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <label>
                  <div>{t('instructor.courses.field_title')}</div>
                  <input type="text" placeholder="Ex: Frappe de balle" {...register('title')} />
                  {errors.title && <div style={{ color: 'crimson' }}>{errors.title.message}</div>}
                </label>
                <label>
                  <div>{t('instructor.courses.field_description')}</div>
                  <RichTextEditor
                    value={watch('description') || ''}
                    onChange={(val) => setValue('description', val, { shouldDirty: true })}
                    minHeight={160}
                  />
                  {errors.description && <div style={{ color: 'crimson' }}>{errors.description.message}</div>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" {...register('isPublished')} />
                  <span>{t('instructor.courses.field_publish')}</span>
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowCreateModal(false)}>{t('instructor.courses.cancel')}</button>
                  <button type="submit" disabled={submitting}>{submitting ? t('instructor.courses.creating') : t('instructor.courses.create')}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale — Éditer un module */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, width: 'min(90vw, 640px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{t('instructor.courses.modal_edit_title')}</h3>
              <button onClick={cancelEdit}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <label>
                <div>{t('instructor.courses.field_title')}</div>
                <input
                  type="text"
                  value={editVals.title}
                  onChange={(e) => setEditVals((v) => ({ ...v, title: e.target.value }))}
                />
              </label>
              <label>
                <div>{t('instructor.courses.field_description')}</div>
                <RichTextEditor
                  value={editVals.description}
                  onChange={(val) => setEditVals((v) => ({ ...v, description: val }))}
                  minHeight={160}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={editVals.isPublished}
                  onChange={(e) => setEditVals((v) => ({ ...v, isPublished: e.target.checked }))}
                />
                <span>{t('instructor.courses.field_publish')}</span>
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={cancelEdit}>{t('instructor.courses.cancel')}</button>
                <button type="button" onClick={saveEdit}>{t('instructor.courses.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale — Confirmation suppression */}
      {showDeleteModal.open && showDeleteModal.id && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, width: 'min(90vw, 520px)' }}>
            <h3>{t('instructor.courses.confirm_delete_title')}</h3>
            <p>{t('instructor.courses.confirm_delete_text')}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowDeleteModal({ open: false, id: null })}>{t('instructor.courses.cancel')}</button>
              <button type="button" className="btn btn-danger" onClick={() => onDelete(showDeleteModal.id!)} disabled={deletingId === showDeleteModal.id}>
                {deletingId === showDeleteModal.id ? t('instructor.courses.deleting') : t('instructor.courses.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorCoursesPage;

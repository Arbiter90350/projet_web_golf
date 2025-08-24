import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { isAxiosError } from 'axios';

type Lesson = {
  id: string;
  title: string;
  order: number;
  validationMode: 'read' | 'pro' | 'qcm';
};

type ProgressItem = {
  lesson: string;
  status: 'not_started' | 'in_progress' | 'completed';
};

type BackendLesson = {
  _id?: string;
  id?: string;
  title: string;
  order: number;
  validationMode: 'read' | 'pro' | 'qcm';
};

type BackendProgress = {
  lesson: string | { _id: string };
  status: 'not_started' | 'in_progress' | 'completed';
};

const CourseDetailPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressItem>>({});

  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) => a.order - b.order),
    [lessons]
  );

  useEffect(() => {
    if (!courseId) return;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const [lessonsRes, progressRes] = await Promise.all([
          api.get(`/courses/${courseId}/lessons`),
          api.get(`/progress/me`, { params: { courseId } }),
        ]);

        const lessonArr = (Array.isArray(lessonsRes?.data?.data) ? lessonsRes.data.data : []) as BackendLesson[];
        const mappedLessons: Lesson[] = [];
        for (const l of lessonArr) {
          const id = l._id ?? l.id;
          if (!id) continue;
          mappedLessons.push({ id, title: l.title, order: l.order, validationMode: l.validationMode });
        }
        setLessons(mappedLessons);

        const progArr = (Array.isArray(progressRes?.data?.data) ? progressRes.data.data : []) as BackendProgress[];
        const progMap: Record<string, ProgressItem> = {};
        for (const p of progArr) {
          if (!p.lesson) continue;
          const lid = typeof p.lesson === 'string' ? p.lesson : p.lesson._id;
          if (!lid) continue;
          progMap[lid] = { lesson: lid, status: p.status };
        }
        setProgress(progMap);
      } catch (err: unknown) {
        const fallback = "Erreur lors du chargement du cours";
        if (isAxiosError(err)) {
          const msg = (err.response?.data as { message?: string } | undefined)?.message;
          setError(msg ?? fallback);
        } else {
          setError(fallback);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [courseId]);

  const markAsRead = async (lessonId: string) => {
    try {
      await api.patch(`/progress/lessons/${lessonId}/read`);
      setProgress((prev) => ({ ...prev, [lessonId]: { lesson: lessonId, status: 'completed' } }));
    } catch (err: unknown) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      alert(msg ?? "Impossible de marquer cette leçon comme lue");
    }
  };

  if (loading) return <div>Chargement…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/courses">← Retour aux cours</Link>
      </div>
      <h2>Détails du cours</h2>
      {sortedLessons.length === 0 ? (
        <div>Aucune leçon pour ce cours.</div>
      ) : (
        <ul>
          {sortedLessons.map((l) => {
            const status = progress[l.id]?.status ?? 'not_started';
            const isReadValidated = l.validationMode === 'read';
            return (
              <li key={l.id} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 80 }}>#{l.order}</span>
                  <strong style={{ minWidth: 240 }}>{l.title}</strong>
                  <span style={{ opacity: 0.8 }}>Mode: {l.validationMode}</span>
                  <span>
                    Statut: {status === 'completed' ? 'Acquis' : status === 'in_progress' ? 'En cours' : 'Non commencé'}
                  </span>
                  {isReadValidated && status !== 'completed' && (
                    <button onClick={() => markAsRead(l.id)}>Marquer comme lu</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CourseDetailPage;

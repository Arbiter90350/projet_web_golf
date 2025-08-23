import { useEffect, useState } from 'react';
import api from '../services/api';
import { isAxiosError } from 'axios';
import ModuleCard from '../components/player/ModuleCard';
import LessonModal from '../components/player/LessonModal';
import { useTranslation } from 'react-i18next';

// Page joueur: liste des modules sous forme de tuiles verticales, avec statut de progression.
// Cliquer un module déroule ses leçons (tuiles). Cliquer une leçon ouvre un popup avec les contenus.
const PlayerCoursesPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<Array<{ id: string; title: string; description?: string }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, Array<{ _id: string; title: string; order: number; validationMode: 'read' | 'pro' | 'qcm' }>>>({});
  const [progressByLesson, setProgressByLesson] = useState<Record<string, 'not_started' | 'in_progress' | 'completed'>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<{ _id: string; title: string; validationMode: 'read' | 'pro' | 'qcm' } | null>(null);
  // Le contenu et les actions sont gérés par le composant LessonModal

  type BackendCourse = {
    _id?: string;
    id?: string;
    title: string;
    description?: string;
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get('/modules');
        // Backend renvoie { status, count, data: Course[] }
        const arr = (Array.isArray(data?.data) ? data.data : []) as BackendCourse[];
        const mapped: Array<{ id: string; title: string; description?: string }> = [];
        for (const c of arr) {
          const id = c._id ?? c.id;
          if (!id) continue;
          mapped.push({ id, title: c.title, description: c.description });
        }
        setModules(mapped);
      } catch (err: unknown) {
        const fallback = t('errors.modules_load');
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
  }, [t]);

  // Helpers UI

  // Compute module status from lesson statuses
  const computeModuleStatus = (moduleId: string): 'not_started' | 'in_progress' | 'completed' => {
    const lessons = lessonsByModule[moduleId] || [];
    if (lessons.length === 0) return 'not_started';
    const statuses = lessons.map((l) => progressByLesson[l._id] || 'not_started');
    if (statuses.every((s) => s === 'completed')) return 'completed';
    if (statuses.some((s) => s === 'in_progress' || s === 'completed')) return 'in_progress';
    return 'not_started';
  };

  // Expand/collapse a module, fetching lessons and progress on first open
  const toggleModule = async (moduleId: string) => {
    if (expandedId === moduleId) {
      setExpandedId(null);
      return;
    }
    // Fetch if not present
    if (!lessonsByModule[moduleId]) {
      try {
        setLoading(true);
        const [lessonsRes, progRes] = await Promise.all([
          api.get(`/modules/${moduleId}/lessons`),
          api.get(`/progress/me`, { params: { courseId: moduleId } }),
        ]);
        const lessons = Array.isArray(lessonsRes.data?.data) ? lessonsRes.data.data : [];
        setLessonsByModule((prev) => ({ ...prev, [moduleId]: lessons }));
        const progArr: Array<{ lesson: string; status: 'not_started' | 'in_progress' | 'completed' }> =
          Array.isArray(progRes.data?.data) ? progRes.data.data : [];
        setProgressByLesson((prev) => {
          const next = { ...prev } as typeof prev;
          for (const p of progArr) next[p.lesson] = p.status;
          return next;
        });
      } catch {
        // Non-bloquant: on laisse l'ouverture même si la progression ne charge pas
      } finally {
        setLoading(false);
      }
    }
    setExpandedId(moduleId);
  };

  const openLessonModal = (lesson: { _id: string; title: string; validationMode: 'read' | 'pro' | 'qcm' }) => {
    setSelectedLesson(lesson);
    setModalOpen(true);
  };

  const handleMarked = async () => {
    if (!selectedLesson) return;
    // MàJ optimiste locale
    setProgressByLesson((prev) => ({ ...prev, [selectedLesson._id]: 'completed' }));
    // Refetch progression pour le module ouvert pour cohérence
    if (expandedId) {
      try {
        const { data } = await api.get(`/progress/me`, { params: { courseId: expandedId } });
        const arr: Array<{ lesson: string; status: 'not_started' | 'in_progress' | 'completed' }>
          = Array.isArray(data?.data) ? data.data : [];
        setProgressByLesson((prev) => {
          const next = { ...prev } as typeof prev;
          for (const p of arr) next[p.lesson] = p.status;
          return next;
        });
      } catch {
        // silencieux: l'optimiste suffit
      }
    }
  };

  if (loading) return <div>{t('modules.loading')}</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <h2>{t('modules.my_modules')}</h2>
      {modules.length === 0 ? (
        <div>{t('modules.none')}</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr', maxWidth: 900 }}>
          {modules.map((m) => {
            const mStatus = computeModuleStatus(m.id);
            return (
              <ModuleCard
                key={m.id}
                module={m}
                moduleStatus={mStatus}
                lessons={lessonsByModule[m.id] || []}
                expanded={expandedId === m.id}
                onToggle={() => toggleModule(m.id)}
                getLessonStatus={(lessonId) => progressByLesson[lessonId] || 'not_started'}
                onOpenLesson={openLessonModal}
              />
            );
          })}
        </div>
      )}

      <LessonModal
        open={modalOpen}
        lesson={selectedLesson}
        onClose={() => setModalOpen(false)}
        onMarked={handleMarked}
      />
    </div>
  );
};

export default PlayerCoursesPage;

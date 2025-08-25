// Page: Détail progression d'un élève (instructeur/admin)
// - Présentation type /courses: cartes modules repliables avec listes de leçons
// - Pour les leçons en validation "pro", l'instructeur peut définir le statut
// - Couleurs d'arrière-plan: vert si validée (completed), jaune pâle si "En cours"
// - Consomme: listCourses(), listLessons(courseId), getPlayerProgress(userId, courseId), proValidateLesson

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listCourses, type Course } from '../services/courses';
import { listLessons, type Lesson } from '../services/lessons';
import ProgressService, { type ProgressStatus, type PlayerLite } from '../services/progress';

const titleStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700 };
const blockStyle: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 };

export default function InstructorPlayerProgressPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, Lesson[]>>({});
  const [progressByLesson, setProgressByLesson] = useState<Record<string, ProgressStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [filter, setFilter] = useState('');

  // Compute module status from lesson statuses
  const computeModuleStatus = (moduleId: string): ProgressStatus => {
    const lessons = lessonsByModule[moduleId] || [];
    if (lessons.length === 0) return 'not_started';
    const statuses = lessons.map((l) => progressByLesson[l.id] || 'not_started');
    if (statuses.every((s) => s === 'completed')) return 'completed';
    if (statuses.some((s) => s === 'in_progress' || s === 'completed')) return 'in_progress';
    return 'not_started';
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cs = await listCourses();
        if (!mounted) return;
        setCourses(cs);
      } catch {
        if (mounted) setError(t('errors.modules_load'));
      }
    })();
    return () => { mounted = false; };
  }, [t]);

  // Charger la liste des joueurs pour la navigation
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ps = await ProgressService.listAssignedPlayers();
        if (!mounted) return;
        setPlayers(ps);
      } catch {
        // silencieux: optionnel
      }
    })();
    return () => { mounted = false; };
  }, []);

  // À chaque changement d'élève, on réinitialise l'état local pour éviter les fuites
  useEffect(() => {
    setExpandedId(null);
    setLessonsByModule({});
    setProgressByLesson({});
  }, [userId]);

  // Préchargement: quand l'élève change et que les cours sont connus, on charge
  // - toutes les leçons de chaque module (pour calculer les % immédiatement)
  // - toute la progression de l'élève (pour colorer et calculer les %)
  useEffect(() => {
    let cancelled = false;
    const prefetch = async () => {
      if (!userId || courses.length === 0) return;
      try {
        setLoading(true);
        setError(null);
        // Charger toutes les leçons par module
        const lessonsPerCourse = await Promise.all(
          courses.map(async (c) => {
            const ls = await listLessons(c.id);
            return { courseId: c.id, lessons: ls };
          })
        );
        if (cancelled) return;
        setLessonsByModule(
          lessonsPerCourse.reduce<Record<string, Lesson[]>>((acc, cur) => {
            acc[cur.courseId] = cur.lessons;
            return acc;
          }, {})
        );

        // Charger toute la progression de l'élève (tous modules)
        const pr = await ProgressService.getPlayerProgress(userId);
        if (cancelled) return;
        setProgressByLesson(() => {
          const next: Record<string, ProgressStatus> = {};
          for (const item of pr) next[item.lesson] = item.status as ProgressStatus;
          return next;
        });
      } catch {
        if (!cancelled) setError(t('instructor.player_progress.error_loading'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void prefetch();
    return () => {
      cancelled = true;
    };
  }, [userId, courses, t]);

  // Toggle module: charge les leçons et la progression au premier dépliage si non préchargé
  const toggleModule = async (moduleId: string) => {
    if (expandedId === moduleId) {
      setExpandedId(null);
      return;
    }
    if (!userId) return;
    if (!lessonsByModule[moduleId]) {
      try {
        setLoading(true);
        const [ls, pr] = await Promise.all([
          listLessons(moduleId),
          ProgressService.getPlayerProgress(userId, moduleId),
        ]);
        setLessonsByModule((prev) => ({ ...prev, [moduleId]: ls }));
        setProgressByLesson((prev) => {
          const next = { ...prev } as typeof prev;
          for (const item of pr) next[item.lesson] = item.status as ProgressStatus;
          return next;
        });
      } catch {
        setError(t('instructor.player_progress.error_loading'));
      } finally {
        setLoading(false);
      }
    }
    setExpandedId(moduleId);
  };

  const updateStatus = async (moduleId: string, lessonId: string, status: ProgressStatus) => {
    if (!userId) return;
    try {
      await ProgressService.proValidateLesson(lessonId, { userId, status });
      // Rafraîchir uniquement la progression du module courant
      const pr = await ProgressService.getPlayerProgress(userId, moduleId);
      setProgressByLesson((prev) => {
        const next = { ...prev } as typeof prev;
        for (const item of pr) next[item.lesson] = item.status as ProgressStatus;
        return next;
      });
    } catch {
      setError(t('errors.unexpected_error'));
    }
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={titleStyle}>{t('instructor.player_progress.title')}</h1>

      {/* Sélecteur d'élève */}
      <div style={{ margin: '10px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <label htmlFor="studentSelect" style={{ fontWeight: 600 }}>
          {t('instructor.player_progress.student_label')}
        </label>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('instructor.player_progress.filter_placeholder')}
          style={{ padding: '6px 10px', minWidth: 260 }}
        />
        <select
          id="studentSelect"
          value={userId || ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val) navigate(`/instructor/players/${val}`);
          }}
          style={{ padding: '6px 10px', minWidth: 280 }}
        >
          {!userId && <option value="">{t('instructor.player_progress.student_placeholder')}</option>}
          {players
            .filter((p) => {
              const hay = `${p.lastName} ${p.firstName} ${p.email}`.toLowerCase();
              const needle = filter.trim().toLowerCase();
              return hay.includes(needle);
            })
            .slice()
            .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.lastName} {p.firstName} — {p.email}
              </option>
            ))}
        </select>
      </div>

      {loading && (
        <div style={{ marginBottom: 8, padding: '6px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6 }}>
          {t('loading')}
        </div>
      )}
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr' }}>
        {courses.map((m) => {
          const mStatus = computeModuleStatus(m.id);
          const expanded = expandedId === m.id;
          const lessons = (lessonsByModule[m.id] || []).slice().sort((a, b) => a.order - b.order);
          const total = lessons.length;
          const completed = total === 0 ? 0 : lessons.filter((l) => (progressByLesson[l.id] || 'not_started') === 'completed').length;
          const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

          return (
            <div key={m.id} style={{ ...blockStyle, borderColor: '#e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 18 }}>{m.title}</strong>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{t(`status.${mStatus}`)}</span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
                    <span>{t('lessons.count', { completed, total })}</span>
                    <span>•</span>
                    <span>{pct}%</span>
                  </div>
                </div>
                <button onClick={() => toggleModule(m.id)} style={{ padding: '6px 10px' }}>
                  {expanded ? t('common.hide') : t('modules.show_lessons')}
                </button>
              </div>

              {/* Barre de progression */}
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              {expanded && (
                <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                  {lessons.map((l) => {
                    const status: ProgressStatus = (progressByLesson[l.id] || 'not_started') as ProgressStatus;
                    const bg = status === 'completed' ? '#dcfce7' : status === 'in_progress' ? '#fef9c3' : 'transparent';
                    const border = status === 'completed' ? '#bbf7d0' : status === 'in_progress' ? '#fde68a' : '#e5e7eb';
                    return (
                      <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', border: `1px solid ${border}`, borderRadius: 8, padding: '8px 10px', background: bg }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{l.order}. {l.title}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {t('instructor.player_progress.validation_label')}: {t(`lessons.validation.${l.validationMode}`)} — {t('instructor.player_progress.current_status')}: {t(`status.${status}`)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => updateStatus(m.id, l.id, 'not_started')}>{t('instructor.player_progress.reset')}</button>
                          <button onClick={() => updateStatus(m.id, l.id, 'in_progress')}>{t('instructor.player_progress.set_in_progress')}</button>
                          <button onClick={() => updateStatus(m.id, l.id, 'completed')}>{t('instructor.player_progress.validate')}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

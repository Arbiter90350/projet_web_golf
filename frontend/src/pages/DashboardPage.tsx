import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';

const DashboardPage = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCourses, setTotalCourses] = useState<number>(0);
  const [lessonsCompleted, setLessonsCompleted] = useState<number>(0);

  type BackendProgress = {
    status: 'not_started' | 'in_progress' | 'completed';
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [coursesRes, progressRes] = await Promise.all([
          api.get('/courses'),
          api.get('/progress/me'),
        ]);

        const coursesArr = Array.isArray(coursesRes?.data?.data) ? coursesRes.data.data : [];
        setTotalCourses(coursesArr.length);

        const progressArr = (Array.isArray(progressRes?.data?.data) ? progressRes.data.data : []) as BackendProgress[];
        setLessonsCompleted(progressArr.filter((p) => p.status === 'completed').length);
      } catch (err: unknown) {
        const fallback = t('errors.unexpected_error');
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

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>{t('titles.dashboard')}</h1>
          {user && (
            <button onClick={logout} className="btn">{t('actions.logout')}</button>
          )}
        </div>

        {user && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
              <div style={{ fontWeight: 600 }}>{t('labels.welcome')}, {user.firstName} {user.lastName}</div>
              <div style={{ color: 'var(--text-muted)' }}>{user.email} • {user.role}</div>
            </div>
          </div>
        )}

        <h2 style={{ marginTop: '1.5rem' }}>{t('metrics.title')}</h2>
        {error && <div style={{ color: 'crimson' }}>{error}</div>}
        {loading ? (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="card" style={{ height: 120, opacity: 0.6 }} />
            <div className="card" style={{ height: 120, opacity: 0.6 }} />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('metrics.courses_available')}</span>
              <span style={{ fontSize: 36, fontWeight: 700 }}>{totalCourses}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('metrics.access_modules')}</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('metrics.lessons_completed')}</span>
              <span style={{ fontSize: 36, fontWeight: 700 }}>{lessonsCompleted}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('metrics.continue_progress')}</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: '1.5rem' }}>
          <div className="tile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{t('cta.continue_learning')}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t('cta.access_modules_and_lessons')}</div>
            </div>
            <Link
              to={user?.role === 'instructor' || user?.role === 'admin' ? '/instructor/courses' : '/courses'}
              className="btn btn-primary"
            >
              {t('cta.view_my_courses')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

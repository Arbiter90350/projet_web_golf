import { useEffect, useMemo, useState } from 'react';
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
  const [lessonsCompleted, setLessonsCompleted] = useState<number>(0);
  const [totalLessons, setTotalLessons] = useState<number>(0);
  const [comms, setComms] = useState<Array<{ id: string; content: string; mediaUrl: string | null }>>([]);

  type BackendProgress = {
    status: 'not_started' | 'in_progress' | 'completed';
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [progressRes, commsRes] = await Promise.allSettled([
          api.get('/progress/me'),
          api.get('/public/communications', { params: { page: 1, limit: 2 } }),
        ]);

        if (progressRes.status === 'fulfilled') {
          const progressArr = (Array.isArray(progressRes.value?.data?.data) ? progressRes.value.data.data : []) as BackendProgress[];
          setTotalLessons(progressArr.length);
          setLessonsCompleted(progressArr.filter((p) => p.status === 'completed').length);
        } else if (isAxiosError(progressRes.reason)) {
          const msg = (progressRes.reason.response?.data as { message?: string } | undefined)?.message;
          setError(msg ?? t('errors.unexpected_error'));
        } else {
          setError(t('errors.unexpected_error'));
        }

        if (commsRes.status === 'fulfilled') {
          const commList = ((commsRes.value?.data?.data?.communications) ?? []) as Array<{ id: string; content: string; mediaUrl?: string | null }>;
          setComms(commList.map(c => ({ id: c.id, content: c.content, mediaUrl: c.mediaUrl ?? null })));
        } else {
          // Ne pas afficher d'erreur pour la section communications
          setComms([]);
        }
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

  const percent = useMemo(() => {
    if (!totalLessons || totalLessons <= 0) return 0;
    return Math.round((lessonsCompleted / totalLessons) * 100);
  }, [lessonsCompleted, totalLessons]);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Titre + bouton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>{t('titles.dashboard')}</h1>
          {user && (
            <button onClick={logout} className="btn">{t('actions.logout')}</button>
          )}
        </div>

        {/* Image d'en-tête */}
        <div style={{ marginTop: '1rem' }}>
          <img
            src="/jpg_dashboard.jpg"
            alt={t('dashboard.alt_header')}
            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }}
          />
        </div>

        {/* Accroche */}
        <div
          className="tile"
          style={{
            marginTop: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 18,
            color: 'var(--text-strong)'
          }}
        >
          {t('dashboard.catchphrase')}
        </div>

        {user && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
              <div style={{ fontWeight: 600 }}>{t('labels.welcome')}, {user.firstName} {user.lastName}</div>
              <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantLigatures: 'none', WebkitFontSmoothing: 'antialiased', fontFeatureSettings: '"liga" 0, "clig" 0' }}>{user.email} • {user.role}</div>
            </div>
          </div>
        )}

        {error && <div style={{ color: 'crimson', marginTop: 8, fontSize: 13 }}>{error}</div>}

        {/* Tuiles de navigation et métriques */}
        <div style={{ marginTop: '1.5rem', opacity: loading ? 0.6 : 1 }}>
          <div className="grid grid-3 md:grid-1">
            {/* Tuile progression leçons terminées (déplacée ici) */}
            <div className="tile" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 120, height: 120 }} aria-hidden>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={radius} stroke="#e5e7eb" strokeWidth="12" fill="none" />
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke="var(--brand-primary)"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{percent}%</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('metrics.lessons_completed')}</span>
                <span style={{ fontSize: 36, fontWeight: 700 }}>{lessonsCompleted}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {t('metrics.progress_count', { completed: lessonsCompleted, total: totalLessons })} • {percent}%
                </span>
              </div>
            </div>

            {/* Suivre mes apprentissages */}
            <div className="tile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t('cta.track_learning')}</div>
                <div style={{ color: 'var(--text-muted)' }}>{t('metrics.continue_progress')}</div>
              </div>
              <Link to="/courses" className="btn btn-primary">{t('cta.view_my_courses')}</Link>
            </div>

            {/* Inscription au club */}
            <div className="tile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t('cta.club_signup')}</div>
                <div style={{ color: 'var(--text-muted)' }}>{t('cta.club_signup_desc')}</div>
              </div>
              <a href="https://golf-rougemont.com" target="_blank" rel="noreferrer" className="btn btn-outline">
                {t('common.open')}
              </a>
            </div>
          </div>
        </div>

        {/* Zone communication/agenda: 2 tuiles */}
        <div style={{ marginTop: '1.5rem' }}>
          <div className="grid grid-2 md:grid-1">
            {/* Tuile 1: Horaire des leçons carte verte (contenu admin) */}
            <div className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{t('dashboard.green_card_schedule_title')}</div>
              {comms[0] ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {comms[0].mediaUrl && (
                    <img src={comms[0].mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />
                  )}
                  <div style={{ color: 'var(--text-muted)' }}>{comms[0].content}</div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.schedule_mgmt_desc')}</div>
              )}
            </div>

            {/* Tuile 2: Communication & événements (contenu admin) */}
            <div className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{t('dashboard.comms_title')}</div>
              {comms[1] ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {comms[1].mediaUrl && (
                    <img src={comms[1].mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />
                  )}
                  <div style={{ color: 'var(--text-muted)' }}>{comms[1].content}</div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.comms_desc')}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

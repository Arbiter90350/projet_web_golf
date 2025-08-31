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
  const [scheduleTile, setScheduleTile] = useState<{ title?: string | null; content: string; mediaUrl: string | null } | null>(null);
  const [eventsTile, setEventsTile] = useState<{ title?: string | null; content: string; mediaUrl: string | null } | null>(null);
  const [extraTiles, setExtraTiles] = useState<Array<{ key: string; title?: string | null; content: string; mediaUrl: string | null }>>([]);
  const [mostAdvanced, setMostAdvanced] = useState<{ lessonId: string; lessonTitle: string; order: number; status: string; updatedAt: string } | null>(null);
  const [latestChanges, setLatestChanges] = useState<Array<{ lessonId: string | null; lessonTitle: string; order: number | null; status: string; updatedAt: string }>>([]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [summaryRes, scheduleRes, eventsRes, extraRes] = await Promise.allSettled([
          api.get('/progress/summary'),
          api.get('/settings/public/dashboard.green_card_schedule'),
          api.get('/settings/public/dashboard.events'),
          api.get('/settings/public-by-prefix/dashboard.tile.'),
        ]);

        if (summaryRes.status === 'fulfilled') {
          const data = summaryRes.value?.data?.data as {
            totals?: { totalLessons?: number; completedCount?: number };
            mostAdvancedInProgress?: { lessonId: string; lessonTitle: string; order: number; status: string; updatedAt: string } | null;
            latestChanges?: Array<{ lessonId: string | null; lessonTitle: string; order: number | null; status: string; updatedAt: string }>;
          };
          setTotalLessons(Number(data?.totals?.totalLessons || 0));
          setLessonsCompleted(Number(data?.totals?.completedCount || 0));
          setMostAdvanced(data?.mostAdvancedInProgress || null);
          setLatestChanges(Array.isArray(data?.latestChanges) ? data!.latestChanges! : []);
        } else if (isAxiosError(summaryRes.reason)) {
          const msg = (summaryRes.reason.response?.data as { message?: string } | undefined)?.message;
          setError(msg ?? t('errors.unexpected_error'));
        } else {
          setError(t('errors.unexpected_error'));
        }

        if (scheduleRes.status === 'fulfilled') {
          const s = (scheduleRes.value?.data?.data?.setting ?? null) as { title?: string | null; content?: string; mediaUrl?: string | null } | null;
          setScheduleTile(s ? { title: s.title ?? null, content: s.content || '', mediaUrl: s.mediaUrl ?? null } : null);
        } else {
          setScheduleTile(null);
        }

        if (eventsRes.status === 'fulfilled') {
          const s = (eventsRes.value?.data?.data?.setting ?? null) as { title?: string | null; content?: string; mediaUrl?: string | null } | null;
          setEventsTile(s ? { title: s.title ?? null, content: s.content || '', mediaUrl: s.mediaUrl ?? null } : null);
        } else {
          setEventsTile(null);
        }

        if (extraRes.status === 'fulfilled') {
          const arr = (extraRes.value?.data?.data?.settings ?? []) as Array<{ key: string; title?: string | null; content?: string; mediaUrl?: string | null }>;
          setExtraTiles(
            arr.map((s) => ({ key: s.key, title: s.title ?? null, content: s.content || '', mediaUrl: s.mediaUrl ?? null }))
          );
        } else {
          setExtraTiles([]);
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

        {/* Tuiles supplémentaires dynamiques */}
        {extraTiles.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Autres tuiles</div>
            <div className="grid grid-2 md:grid-1">
              {extraTiles.map((t) => (
                <div key={t.key} className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{t.title || '—'}</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {t.mediaUrl && <img src={t.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{t.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tuile récap progression (étape la plus avancée + dernières modifications) */}
        <div style={{ marginTop: '1rem' }}>
          <div className="tile" style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 700 }}>{t('dashboard.progress_summary_title')}</div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('dashboard.most_advanced_in_progress')}</div>
              {mostAdvanced ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{mostAdvanced.lessonTitle}</span>
                  <span style={{ color: 'var(--text-muted)' }}>• ordre {mostAdvanced.order}</span>
                  <span className="chip">{t(`status.${mostAdvanced.status}`)}</span>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.none_in_progress')}</div>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('dashboard.latest_changes')}</div>
              {latestChanges.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {latestChanges.map((c, idx) => (
                    <li key={`${c.lessonId ?? 'x'}-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{c.lessonTitle}</span>
                      {typeof c.order === 'number' && <span style={{ color: 'var(--text-muted)' }}>• ordre {c.order}</span>}
                      <span className="chip">{t(`status.${c.status}`)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>• {new Date(c.updatedAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.no_recent_changes')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Zone communication/agenda: 2 tuiles */}
        <div style={{ marginTop: '1.5rem' }}>
          <div className="grid grid-2 md:grid-1">
            {/* Tuile 1: Horaire des leçons carte verte (contenu admin) */}
            <div className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{scheduleTile?.title || t('dashboard.green_card_schedule_title')}</div>
              {scheduleTile ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {scheduleTile.mediaUrl && (
                    <img src={scheduleTile.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />
                  )}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{scheduleTile.content}</div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>—</div>
              )}
            </div>

            {/* Tuile 2: Communication & événements (contenu admin) */}
            <div className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{eventsTile?.title || t('dashboard.comms_title')}</div>
              {eventsTile ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {eventsTile.mediaUrl && (
                    <img src={eventsTile.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />
                  )}
                  <div style={{ color: 'var(--text-muted)' }}>{eventsTile.content}</div>
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

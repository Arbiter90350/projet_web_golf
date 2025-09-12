import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toSafeHtml } from '../utils/sanitize';

const DashboardPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonsCompleted, setLessonsCompleted] = useState<number>(0);
  const [totalLessons, setTotalLessons] = useState<number>(0);
  const [scheduleTile, setScheduleTile] = useState<{ title?: string | null; content: string; mediaUrl: string | null; linkUrl?: string | null } | null>(null);
  const [eventsTile, setEventsTile] = useState<{ title?: string | null; content: string; mediaUrl: string | null; linkUrl?: string | null } | null>(null);
  const [extraTiles, setExtraTiles] = useState<Array<{ key: string; title?: string | null; content: string; mediaUrl: string | null; linkUrl?: string | null }>>([]);
  // Supprimé: mostAdvanced n'est plus affiché dans l'UI
  const [latestChanges, setLatestChanges] = useState<Array<{
    lessonId: string | null;
    lessonTitle: string;
    order: number | null;
    status: string;
    updatedAt: string;
    courseTitle?: string | null;
    courseOrder?: number | null;
  }>>([]);

  // Image d'en-tête configurable (depuis settings publics)
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [summaryRes, scheduleRes, eventsRes, extraRes, headerImgRes] = await Promise.allSettled([
          api.get('/progress/summary'),
          api.get('/settings/public/dashboard.green_card_schedule'),
          api.get('/settings/public/dashboard.events'),
          api.get('/settings/public-by-prefix/dashboard.tile.'),
          api.get('/settings/public/dashboard.header_image'),
        ]);

        if (summaryRes.status === 'fulfilled') {
          const data = summaryRes.value?.data?.data as {
            totals?: { totalLessons?: number; completedCount?: number };
            mostAdvancedInProgress?: {
              lessonId: string;
              lessonTitle: string;
              order: number;
              status: string;
              updatedAt: string;
              courseTitle?: string | null;
              courseOrder?: number | null;
            } | null;
            latestChanges?: Array<{
              lessonId: string | null;
              lessonTitle: string;
              order: number | null;
              status: string;
              updatedAt: string;
              courseTitle?: string | null;
              courseOrder?: number | null;
            }>;
          };
          setTotalLessons(Number(data?.totals?.totalLessons || 0));
          setLessonsCompleted(Number(data?.totals?.completedCount || 0));
          // mostAdvanced n'est plus utilisé dans l'UI
          setLatestChanges(Array.isArray(data?.latestChanges) ? data!.latestChanges! : []);
        } else if (isAxiosError(summaryRes.reason)) {
          const msg = (summaryRes.reason.response?.data as { message?: string } | undefined)?.message;
          setError(msg ?? t('errors.unexpected_error'));
        } else {
          setError(t('errors.unexpected_error'));
        }

        if (scheduleRes.status === 'fulfilled') {
          const s = (scheduleRes.value?.data?.data?.setting ?? null) as { title?: string | null; content?: string; mediaUrl?: string | null; linkUrl?: string | null } | null;
          setScheduleTile(s ? { title: s.title ?? null, content: s.content || '', mediaUrl: s.mediaUrl ?? null, linkUrl: s.linkUrl ?? null } : null);
        } else {
          setScheduleTile(null);
        }

        if (eventsRes.status === 'fulfilled') {
          const s = (eventsRes.value?.data?.data?.setting ?? null) as { title?: string | null; content?: string; mediaUrl?: string | null; linkUrl?: string | null } | null;
          setEventsTile(s ? { title: s.title ?? null, content: s.content || '', mediaUrl: s.mediaUrl ?? null, linkUrl: s.linkUrl ?? null } : null);
        } else {
          setEventsTile(null);
        }

        if (extraRes.status === 'fulfilled') {
          const arr = (extraRes.value?.data?.data?.settings ?? []) as Array<{ key: string; title?: string | null; content?: string; mediaUrl?: string | null; linkUrl?: string | null }>;
          const mapped = arr.map((s) => ({ key: s.key, title: s.title ?? null, content: s.content || '', mediaUrl: s.mediaUrl ?? null, linkUrl: s.linkUrl ?? null }));
          setExtraTiles(mapped);
        } else {
          setExtraTiles([]);
        }

        // Header image setting (facultatif)
        if (headerImgRes.status === 'fulfilled') {
          const s = (headerImgRes.value?.data?.data?.setting ?? null) as { mediaUrl?: string | null } | null;
          setHeaderImageUrl(s?.mediaUrl ?? null);
        } else {
          setHeaderImageUrl(null);
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
  const lastCompleted = useMemo(() => {
    if (!latestChanges?.length) return null;
    const done = latestChanges.filter((c) => ['completed', 'done', 'read'].includes((c.status || '').toLowerCase()));
    if (!done.length) return null;
    return done.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  }, [latestChanges]);

  return (
    <div style={{ padding: '2rem 1rem' }} className="page-fade-in">
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Titre */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>{t('titles.dashboard')}</h1>
        </div>

        {/* Image d'en-tête (Object Storage uniquement) */}
        {headerImageUrl && (
          <div style={{ marginTop: '1rem' }}>
            <img
              src={headerImageUrl}
              alt={t('dashboard.alt_header')}
              style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }}
            />
          </div>
        )}

        {/* Slogan retiré */}

        {user && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
              <div style={{ fontWeight: 600 }}>{t('labels.welcome')}, {user.firstName} {user.lastName}</div>
            </div>
          </div>
        )}

        {error && <div style={{ color: 'crimson', marginTop: 8, fontSize: 13 }}>{error}</div>}

        {/* Tuiles de navigation et métriques */}
        <div style={{ marginTop: '1.5rem', opacity: loading ? 0.6 : 1 }}>
          <div className="grid grid-2 md:grid-1">
            {/* Tuile progression (simplifiée) */}
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
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {t('metrics.progress_count', { completed: lessonsCompleted, total: totalLessons })}
                </span>
              </div>
            </div>

            {/* CTA programme: un gros bouton */}
            <div className="tile" style={{ display: 'flex' }}>
              <Link
                to="/courses"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '16px 24px', fontSize: 18, fontWeight: 700 }}
                onClick={() => navigate('/courses')}
              >
                {t('cta.access_program')}
              </Link>
            </div>
          </div>
        </div>

        {/* (Déplacé en bas) Tuiles supplémentaires dynamiques */}

        {/* Tuile récap progression (simplifiée: dernière étape validée) */}
        <div style={{ marginTop: '1rem' }}>
          <div className="tile" style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 700 }}>{t('dashboard.last_completed_title')}</div>
            {lastCompleted ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{lastCompleted.lessonTitle}</span>
                <span style={{ color: 'var(--text-muted)' }}>• {new Date(lastCompleted.updatedAt).toLocaleDateString('fr-FR')}</span>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.none_completed_recently')}</div>
            )}
          </div>
        </div>

        {/* Zone communication/agenda: 2 tuiles */}
        <div style={{ marginTop: '1.5rem' }}>
          <div className="grid grid-2 md:grid-1">
            {/* Tuile 1: Horaire des leçons carte verte (contenu admin) */}
            <div className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{scheduleTile?.title || t('dashboard.green_card_schedule_title')}</div>
              {scheduleTile ? (
                scheduleTile.linkUrl ? (
                  <a href={scheduleTile.linkUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {scheduleTile.mediaUrl && (
                        <img src={scheduleTile.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />
                      )}
                      <div dangerouslySetInnerHTML={{ __html: toSafeHtml(scheduleTile.content) }} />
                    </div>
                  </a>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {scheduleTile.mediaUrl && (
                      <img src={scheduleTile.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />
                    )}
                    <div dangerouslySetInnerHTML={{ __html: toSafeHtml(scheduleTile.content) }} />
                  </div>
                )
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>—</div>
              )}
            </div>

            {/* Tuile 2: Communication & événements (contenu admin) */}
            <div className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{eventsTile?.title || t('dashboard.comms_title')}</div>
              {eventsTile ? (
                eventsTile.linkUrl ? (
                  <a href={eventsTile.linkUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {eventsTile.mediaUrl && (
                        <img src={eventsTile.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />
                      )}
                      <div dangerouslySetInnerHTML={{ __html: toSafeHtml(eventsTile.content) }} />
                    </div>
                  </a>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {eventsTile.mediaUrl && (
                      <img src={eventsTile.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />
                    )}
                    <div dangerouslySetInnerHTML={{ __html: toSafeHtml(eventsTile.content) }} />
                  </div>
                )
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.comms_desc')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Tuiles supplémentaires dynamiques (sous les tuiles fixes) */}
        {extraTiles.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="grid grid-2 md:grid-1">
              {extraTiles.map((t) => (
                <div key={t.key} className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{t.title || '—'}</div>
                  {t.linkUrl ? (
                    <a href={t.linkUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {t.mediaUrl && <img src={t.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />}
                        <div dangerouslySetInnerHTML={{ __html: toSafeHtml(t.content) }} />
                      </div>
                    </a>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {t.mediaUrl && <img src={t.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 6 }} />}
                      <div dangerouslySetInnerHTML={{ __html: toSafeHtml(t.content) }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

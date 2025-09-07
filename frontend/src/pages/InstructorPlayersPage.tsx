// Page: Liste des élèves assignés (instructeur/admin)
// - Sécurité: accès via ProtectedRoute + RequireRole(["instructor","admin"]).
// - Appels API: ProgressService.listAssignedPlayers().
// - UX: liste simple cliquable menant au détail de progression d'un élève.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProgressService, { type PlayerLite } from '../services/progress';

const containerStyle: React.CSSProperties = { maxWidth: 900 };
const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '12px 14px',
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
};

const titleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 600 };
const subtitleStyle: React.CSSProperties = { color: '#475569', fontSize: 13 };

export default function InstructorPlayersPage() {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [activityFilter, setActivityFilter] = useState<string>(''); // '', 'today', '1d', '4d', '7dplus'

  // Helpers temps relatif (memorized)
  const daysSince = useCallback((iso?: string | null) => {
    if (!iso) return Number.POSITIVE_INFINITY;
    const d = new Date(iso).getTime();
    if (!Number.isFinite(d)) return Number.POSITIVE_INFINITY;
    const now = Date.now();
    const diff = Math.max(0, now - d);
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  }, []);
  const activityBucket = useCallback((iso?: string | null) => {
    const d = daysSince(iso);
    if (d === 0) return 'today';
    if (d <= 1) return '1d';
    if (d <= 4) return '4d';
    return '7dplus';
  }, [daysSince]);
  const relativeLabel = useCallback((iso?: string | null) => {
    if (!iso) return t('instructor.players.tags.never', 'Jamais');
    const d = daysSince(iso);
    if (d === 0) return t('instructor.players.rel.today', "Aujourd'hui");
    if (d === 1) return t('instructor.players.rel.one_day', '1 jour');
    if (d < 7) return t('instructor.players.rel.n_days', { count: d });
    const weeks = Math.floor(d / 7);
    if (weeks === 1) return t('instructor.players.rel.one_week', '1 semaine');
    return t('instructor.players.rel.n_weeks', { count: weeks });
  }, [daysSince, t]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await ProgressService.listAssignedPlayers();
        if (mounted) setPlayers(data);
      } catch {
        if (mounted) setError(t('instructor.players.error_loading'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = players.filter((p) => {
      if (!q) return true;
      const ln = (p.lastName || '').toLowerCase();
      const fn = (p.firstName || '').toLowerCase();
      const em = (p.email || '').toLowerCase();
      return ln.includes(q) || fn.includes(q) || em.includes(q);
    });
    if (moduleFilter) {
      arr = arr.filter((p) => (p.mostAdvancedInProgress?.courseTitle || '') === moduleFilter);
    }
    if (activityFilter) {
      arr = arr.filter((p) => activityBucket(p.lastProgressAt) === activityFilter);
    }
    return arr;
  }, [players, query, moduleFilter, activityFilter, activityBucket]);

  const moduleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) {
      const title = p.mostAdvancedInProgress?.courseTitle;
      if (title) set.add(title);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [players]);

  // (responsive handled via CSS utility classes)

  return (
    <div className="container" style={containerStyle}>
      <h1 style={titleStyle}>{t('instructor.players.title')}</h1>
      {/* Barre de recherche */}
      <div className="mt-2 mb-3">
        <label htmlFor="players-search" style={{ marginRight: 8, fontSize: 13, color: '#475569' }}>
          {t('instructor.players.search_label', 'Rechercher')}
        </label>
        <input
          id="players-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('instructor.players.search_placeholder', 'Nom, prénom ou email...')}
          className="md:w-full"
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, width: '100%', maxWidth: 420 }}
        />
      </div>
      {/* Filtres tags */}
      <div className="mt-2 mb-3" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#475569' }}>{t('instructor.players.filters.module_label', 'Module')}</span>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
            <option value="">{t('instructor.players.filters.module_all', 'Tous modules')}</option>
            {moduleOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#475569' }}>{t('instructor.players.filters.activity_label', 'Activité')}</span>
          <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
            <option value="">{t('instructor.players.filters.activity_all', 'Toute activité')}</option>
            <option value="today">{t('instructor.players.filters.activity_today', "Aujourd'hui")}</option>
            <option value="1d">{t('instructor.players.filters.activity_1d', '≤ 1 jour')}</option>
            <option value="4d">{t('instructor.players.filters.activity_4d', '≤ 4 jours')}</option>
            <option value="7dplus">{t('instructor.players.filters.activity_7plus', '≥ 7 jours')}</option>
          </select>
        </label>
        {(moduleFilter || activityFilter) && (
          <button className="btn" onClick={() => { setModuleFilter(''); setActivityFilter(''); }}>
            {t('instructor.players.filters.clear', 'Effacer filtres')}
          </button>
        )}
      </div>
      {loading && <div>{t('loading')}</div>}
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ color: '#64748b' }}>{t('instructor.players.none')}</div>
      )}

      <div className="grid sm:grid-1" style={{ gap: 10, marginTop: 12 }}>
        {filtered.map((p) => (
          <div key={p.id} className="tile" style={cardStyle}>
            <div>
              <div style={titleStyle}>{p.lastName} {p.firstName}</div>
              <div style={subtitleStyle}>{p.email}</div>
              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {p.mostAdvancedInProgress?.courseTitle && (
                  <button
                    type="button"
                    onClick={() => setModuleFilter(p.mostAdvancedInProgress?.courseTitle || '')}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 999,
                      padding: '2px 8px',
                      background: 'white',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                    title={t('instructor.players.tags.filter_by_module', 'Filtrer par module')}
                  >
                    {t('instructor.players.tags.module', 'Module')}: {p.mostAdvancedInProgress.courseTitle}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActivityFilter(activityBucket(p.lastProgressAt))}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 999,
                    padding: '2px 8px',
                    background: 'white',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                  title={t('instructor.players.tags.filter_by_activity', 'Filtrer par activité')}
                >
                  {t('instructor.players.tags.last_progress', 'Dernière progression')}: {relativeLabel(p.lastProgressAt)}
                </button>
              </div>
            </div>
            <div>
              <Link to={`/instructor/players/${p.id}`} style={{ textDecoration: 'none' }}>
                {t('common.open')} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

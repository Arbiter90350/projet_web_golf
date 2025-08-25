// Page: Liste des élèves assignés (instructeur/admin)
// - Sécurité: accès via ProtectedRoute + RequireRole(["instructor","admin"]).
// - Appels API: ProgressService.listAssignedPlayers().
// - UX: liste simple cliquable menant au détail de progression d'un élève.

import { useEffect, useMemo, useState } from 'react';
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
    if (!q) return players;
    return players.filter((p) => {
      const ln = (p.lastName || '').toLowerCase();
      const fn = (p.firstName || '').toLowerCase();
      const em = (p.email || '').toLowerCase();
      return ln.includes(q) || fn.includes(q) || em.includes(q);
    });
  }, [players, query]);

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>{t('instructor.players.title')}</h1>
      {/* Barre de recherche */}
      <div style={{ margin: '8px 0 12px 0' }}>
        <label htmlFor="players-search" style={{ marginRight: 8, fontSize: 13, color: '#475569' }}>
          {t('instructor.players.search_label', 'Rechercher')}
        </label>
        <input
          id="players-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('instructor.players.search_placeholder', 'Nom, prénom ou email...')}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, width: '100%', maxWidth: 360 }}
        />
      </div>
      {loading && <div>{t('loading')}</div>}
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ color: '#64748b' }}>{t('instructor.players.none')}</div>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {filtered.map((p) => (
          <div key={p.id} style={cardStyle}>
            <div>
              <div style={titleStyle}>{p.lastName} {p.firstName}</div>
              <div style={subtitleStyle}>{p.email}</div>
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

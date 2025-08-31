import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EnablePushBanner from '../EnablePushBanner';

const linkStyle: CSSProperties = {
  display: 'block',
  padding: '0.6rem 0.8rem',
  borderRadius: 8,
  color: '#0f172a',
  textDecoration: 'none',
};

const activeStyle: CSSProperties = {
  ...linkStyle,
  background: '#e2e8f0',
  fontWeight: 600,
};

const DashboardLayout = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const role = user?.role;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Détecte le mode mobile (<= 768px)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // Bloque le scroll de la page quand le menu mobile est ouvert
  useEffect(() => {
    if (isMobile && menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isMobile, menuOpen]);

  const commonNav = [
    { to: '/dashboard', label: t('titles.dashboard'), end: true },
  ];

  const playerNav = [
    { to: '/courses', label: 'Mes cours' },
  ];

  const instructorNav = [
    { to: '/instructor/courses', label: 'Cours (instructeur)' },
    { to: '/instructor/players', label: 'Élèves (instructeur)' },
    { to: '/instructor/files', label: 'Stockage (fichiers)' },
  ];

  const adminNav = [
    { to: '/admin/users', label: 'Utilisateurs (admin)' },
    { to: '/admin/tiles', label: 'Tuiles (admin)' },
    { to: '/admin/push-notifications', label: 'Notifications Push (admin)' },
  ];

  const gridColumns = isMobile ? '1fr' : '260px 1fr';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: gridColumns, minHeight: '100vh', position: 'relative' }}>
      {/* Backdrop cliquable en mobile */}
      {isMobile && menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 30,
          }}
        />
      )}

      <aside
        style={{
          borderRight: '1px solid #e5e7eb',
          padding: '1rem',
          background: '#f8fafc',
          // Drawer en mobile
          position: isMobile ? 'fixed' : 'static',
          top: isMobile ? 0 : undefined,
          left: isMobile ? 0 : undefined,
          height: isMobile ? '100vh' : undefined,
          width: isMobile ? '82vw' : undefined,
          maxWidth: isMobile ? 320 : undefined,
          transform: isMobile ? (menuOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: isMobile ? 'transform 200ms ease' : undefined,
          zIndex: isMobile ? 40 : undefined,
          boxShadow: isMobile ? '0 10px 25px rgba(0,0,0,0.25)' : undefined,
        }}
        aria-hidden={isMobile && !menuOpen}
      >
        {isMobile && (
          <button
            onClick={() => setMenuOpen(false)}
            className="btn btn-outline"
            style={{ marginBottom: '0.8rem' }}
            aria-label="Fermer le menu"
          >
            ✕ Fermer
          </button>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <strong>Fairway Hub</strong>
        </div>
        <NavLink 
          to="/mon-compte" 
          style={({ isActive }) => ({
            ...(isActive ? activeStyle : linkStyle),
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500,
          })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Mon compte
        </NavLink>
        <div style={{ marginBottom: '1rem', fontSize: 14, color: '#475569' }}>
          {user ? (
            <div>
              <div>{user.firstName} {user.lastName}</div>
              <div style={{ fontSize: 12 }}>{user.email}</div>
              <div style={{ fontSize: 12 }}>Rôle: {user.role}</div>
            </div>
          ) : (
            <div>Non connecté</div>
          )}
        </div>

        <nav style={{ display: 'grid', gap: 6 }}>
          {role === 'player' && commonNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>
              {n.label}
            </NavLink>
          ))}

          {role === 'player' && playerNav.map((n) => (
            <NavLink key={n.to} to={n.to} style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>
              {n.label}
            </NavLink>
          ))}

          {(role === 'instructor' || role === 'admin') && instructorNav.map((n) => (
            <NavLink key={n.to} to={n.to} style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>
              {n.label}
            </NavLink>
          ))}

          {role === 'admin' && adminNav.map((n) => (
            <NavLink key={n.to} to={n.to} style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>
              {n.label}
            </NavLink>
          ))}

          <button onClick={logout} style={{ marginTop: '0.8rem' }}>{t('actions.logout')}</button>
        </nav>
      </aside>

      <main style={{ padding: '1.5rem' }}>
        {/* Barre supérieure avec bouton hamburger en mobile */}
        {isMobile && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="btn btn-outline"
              aria-pressed={menuOpen}
              aria-label="Basculer le menu"
            >
              ☰ Menu
            </button>
          </div>
        )}
        {user && <EnablePushBanner />}
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;

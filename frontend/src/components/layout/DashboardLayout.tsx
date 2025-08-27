import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { CSSProperties } from 'react';

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
  const { user, logout } = useAuth();
  const role = user?.role;

  const commonNav = [
    { to: '/dashboard', label: 'Aperçu', end: true },
  ];

  const playerNav = [
    { to: '/courses', label: 'Mes cours' },
  ];

  const instructorNav = [
    { to: '/instructor/courses', label: 'Cours (instructeur)' },
    { to: '/instructor/players', label: 'Élèves (instructeur)' },
  ];

  const adminNav = [
    { to: '/admin/users', label: 'Utilisateurs (admin)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh' }}>
      <aside style={{ borderRight: '1px solid #e5e7eb', padding: '1rem' }}>
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

          <button onClick={logout} style={{ marginTop: '0.8rem' }}>Se déconnecter</button>
        </nav>
      </aside>

      <main style={{ padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;

import { useAuth } from '../hooks/useAuth';

const DashboardPage = () => {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Tableau de bord</h1>
      {user && (
        <div>
          <p>Bienvenue, {user.firstName} {user.lastName}!</p>
          <p>Email: {user.email}</p>
          <p>Rôle: {user.role}</p>
          <button onClick={logout} style={{ marginTop: '1rem' }}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

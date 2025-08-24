// Page d'administration des utilisateurs (squelette)
// NOTE: les endpoints et colonnes seront branchés lors de l'implémentation.
import { useEffect, useState } from 'react';
import api from '../services/api';
import { isAxiosError } from 'axios';

interface UserRow { id: string; email: string; role: 'player' | 'instructor' | 'admin'; firstName: string; lastName: string; }

const AdminUsersPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        // Placeholder — à adapter vers l'endpoint réel admin (ex: /users)
        const { data } = await api.get('/auth/me');
        // On affiche au moins le current user pour vérifier le wiring
        const me = data?.data?.user;
        if (me) setUsers([{ id: me.id, email: me.email, role: me.role, firstName: me.firstName, lastName: me.lastName }]);
      } catch (err: unknown) {
        const fallback = 'Erreur lors du chargement des utilisateurs';
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
  }, []);

  if (loading) return <div>Chargement des utilisateurs...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <h2>Utilisateurs (admin)</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '6px' }}>Nom</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '6px' }}>Email</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '6px' }}>Rôle</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px' }}>{u.firstName} {u.lastName}</td>
              <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px' }}>{u.email}</td>
              <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px' }}>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminUsersPage;

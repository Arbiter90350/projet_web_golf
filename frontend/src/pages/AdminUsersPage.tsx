// Page d'administration des utilisateurs (squelette)
// NOTE: les endpoints et colonnes seront branchés lors de l'implémentation.
import { useEffect, useState } from 'react';
import api from '../services/api';
import { isAxiosError } from 'axios';
import { useToast } from '../contexts/toast-context';
import { useAuth } from '../hooks/useAuth';
import ConfirmDialog from '../components/ConfirmDialog';

type UserRole = 'player' | 'instructor' | 'admin';
interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isEmailVerified?: boolean;
}

const AdminUsersPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const { user: me } = useAuth();
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const loadUsers = async (p = page) => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page: p, limit };
      if (debouncedQ) params.q = debouncedQ;
      if (roleFilter !== 'all') params.role = roleFilter;
      const { data } = await api.get('/users', { params });
      const list = (data?.data?.users ?? []) as Array<{ id: string; email: string; role: UserRole; firstName: string; lastName: string; isEmailVerified?: boolean }>;
      const pag = data?.data?.pagination as { pages?: number } | undefined;
      setUsers(list);
      setTotalPages(pag?.pages ?? 1);
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

  const openDeleteConfirm = (user: UserRow) => {
    if (me && user.id === me.id) {
      toast.error("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }
    setPendingDelete(user);
    setConfirmOpen(true);
  };

  const performDelete = async () => {
    const user = pendingDelete;
    if (!user) return;
    // Optimistic UI: retirer temporairement
    const prev = users.slice();
    setUsers((curr) => curr.filter((u) => u.id !== user.id));
    setUpdating((m) => ({ ...m, [user.id]: true }));
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('Utilisateur supprimé');
      setPage(1);
      await loadUsers(1);
    } catch (err: unknown) {
      setUsers(prev);
      const msg = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Échec de la suppression')
        : 'Échec de la suppression';
      toast.error(msg);
    } finally {
      setUpdating((m) => ({ ...m, [user.id]: false }));
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  useEffect(() => {
    void loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Détection mobile (CSS breakpoint équivalent)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // Debounce pour la recherche texte
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQ(query.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  // Recharge quand filtres changent (et remet à la page 1)
  useEffect(() => {
    setPage(1);
    void loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, roleFilter]);

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    // Optimistic update
    const prev = users.slice();
    setUsers((curr) => curr.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    setUpdating((m) => ({ ...m, [userId]: true }));
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      toast.success('Rôle mis à jour');
    } catch (err: unknown) {
      // rollback
      setUsers(prev);
      const msg = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Échec de la mise à jour du rôle')
        : 'Échec de la mise à jour du rôle';
      toast.error(msg);
    } finally {
      setUpdating((m) => ({ ...m, [userId]: false }));
    }
  };

  if (loading) return <div>Chargement des utilisateurs...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div className="container">
      <h2 className="mt-3">Utilisateurs (admin)</h2>
      {/* Barre de filtres responsive */}
      <div className="flex wrap items-center gap-3 mt-2 mb-3 md:stack">
        <input
          type="text"
          placeholder="Rechercher par nom ou email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, minWidth: 220 }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
        >
          <option value="all">Tous les rôles</option>
          <option value="player">player</option>
          <option value="instructor">instructor</option>
          <option value="admin">admin</option>
        </select>
      </div>
      {/* Desktop: tableau scrollable si étroit */}
      {!isMobile && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table-clean" style={{ width: '100%', marginTop: 8, tableLayout: 'fixed', minWidth: 720 }}>
            <colgroup>
              <col style={{ width: '36%' }} />
              <col style={{ width: '39%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isUnverified = u.isEmailVerified === false;
                const isFocused = focusedRowId === u.id;
                const trClass = `${isUnverified ? 'table-row-unverified ' : ''}${isFocused ? 'table-row-focused ' : ''}table-row-hover`;
                return (
                  <tr key={u.id} className={trClass}>
                    <td>
                      {u.firstName} {u.lastName}
                      {isUnverified && (
                        <span className="badge badge-unverified" style={{ marginLeft: 8 }}>Non vérifié</span>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onFocus={() => setFocusedRowId(u.id)}
                        onBlur={() => setFocusedRowId((curr) => (curr === u.id ? null : curr))}
                        onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                        disabled={!!updating[u.id]}
                        style={{ width: '100%' }}
                      >
                        <option value="player">player</option>
                        <option value="instructor">instructor</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={!!updating[u.id] || (me ? me.id === u.id : false)}
                        title={me && me.id === u.id ? 'Vous ne pouvez pas vous supprimer' : 'Supprimer cet utilisateur'}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        onMouseDownCapture={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); openDeleteConfirm(u); }}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '10px', color: '#64748b' }}>Aucun utilisateur</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile: cartes compactes */}
      {isMobile && (
        <div className="grid sm:grid-1" style={{ gap: 10 }}>
          {users.map((u) => {
            const isUnverified = u.isEmailVerified === false;
            return (
              <div key={u.id} className="tile" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{u.firstName} {u.lastName}
                    {isUnverified && (
                      <span className="badge badge-unverified" style={{ marginLeft: 8 }}>Non vérifié</span>
                    )}
                  </div>
                  <div style={{ color: '#475569', fontSize: 12 }}>{u.email}</div>
                  <div className="mt-2">
                    <label style={{ fontSize: 12, color: '#64748b', marginRight: 6 }}>Rôle</label>
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                      disabled={!!updating[u.id]}
                    >
                      <option value="player">player</option>
                      <option value="instructor">instructor</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={!!updating[u.id] || (me ? me.id === u.id : false)}
                    title={me && me.id === u.id ? 'Vous ne pouvez pas vous supprimer' : 'Supprimer cet utilisateur'}
                    onClick={() => openDeleteConfirm(u)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <div style={{ color: '#64748b' }}>Aucun utilisateur</div>
          )}
        </div>
      )}

      {/* Pagination simple */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" disabled={page <= 1 || loading} onClick={async () => { const np = Math.max(1, page - 1); setPage(np); await loadUsers(np); }}>Précédent</button>
        <span>Page {page} / {totalPages}</span>
        <button className="btn" disabled={page >= totalPages || loading} onClick={async () => { const np = Math.min(totalPages, page + 1); setPage(np); await loadUsers(np); }}>Suivant</button>
      </div>
      {/* Dialogue de confirmation de suppression */}
      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer l'utilisateur"
        message={<span>Cette action est irréversible. Confirmer la suppression de {pendingDelete ? `${pendingDelete.firstName} ${pendingDelete.lastName} (${pendingDelete.email})` : 'cet utilisateur'} ?</span>}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={performDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); }}
      />
    </div>
  );
};

export default AdminUsersPage;

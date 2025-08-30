// Page d'administration des communications
// - CRUD admin-only via API /communications
// - Intégration FilePicker pour sélectionner un média (fileName)
// - i18n via useTranslation
// - Feedback via useToast

import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import FilePicker from '../components/FileManager/FilePicker';
import type { PickedFile } from '../components/FileManager/FilePicker';
import { useToast } from '../contexts/toast-context';
import ConfirmDialog from '../components/ConfirmDialog';

interface CommItem {
  id: string;
  content: string;
  mediaFileName: string | null;
  mediaUrl: string | null;
  visibleFrom: string | null;
  visibleUntil: string | null;
  createdBy?: { id: string; firstName?: string; lastName?: string } | null;
  createdAt: string;
  updatedAt: string;
}

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 10;

const AdminCommunicationsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const debouncedQ = useDebounced(query);

  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cContent, setCContent] = useState('');
  const [cFileName, setCFileName] = useState<string>('');
  const [cVisibleFrom, setCVisibleFrom] = useState<string>('');
  const [cVisibleUntil, setCVisibleUntil] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{ content: string; fileName: string | null; visibleFrom: string; visibleUntil: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CommItem | null>(null);

  const canSubmitCreate = useMemo(() => cContent.trim().length > 0 && !creating, [cContent, creating]);

  const resetCreateForm = () => {
    setCContent('');
    setCFileName('');
    setCVisibleFrom('');
    setCVisibleUntil('');
  };

  const loadItems = async (p = page) => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page: p, limit: PAGE_SIZE };
      if (debouncedQ) params.q = debouncedQ;
      const { data } = await api.get('/communications', { params });
      const list = (data?.data?.communications ?? []) as CommItem[];
      const pag = data?.data?.pagination as { pages?: number } | undefined;
      setItems(list);
      setTotalPages(pag?.pages ?? 1);
    } catch (err: unknown) {
      const fallback = t('admin.comms.error_loading');
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

  useEffect(() => {
    setPage(1);
    void loadItems(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  useEffect(() => {
    void loadItems(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickedCreate = (file: PickedFile) => {
    setCFileName(file.fileName);
  };

  const onPickedEdit = (file: PickedFile) => {
    setEditVals((v) => (v ? { ...v, fileName: file.fileName } : v));
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!canSubmitCreate) return;
    // Validation côté client des dates
    if (cVisibleFrom && cVisibleUntil) {
      const vf = new Date(cVisibleFrom).getTime();
      const vu = new Date(cVisibleUntil).getTime();
      if (vu < vf) {
        toast.error(t('admin.comms.validation.date_order'));
        return;
      }
    }
    try {
      setCreating(true);
      await api.post('/communications', {
        content: cContent.trim(),
        mediaFileName: cFileName || undefined,
        visibleFrom: cVisibleFrom || undefined,
        visibleUntil: cVisibleUntil || undefined,
      });
      toast.success(t('admin.comms.create_success'));
      setCreateOpen(false);
      resetCreateForm();
      setPage(1);
      await loadItems(1);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      toast.error(msg ?? t('admin.comms.create_failed'));
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (it: CommItem) => {
    setEditingId(it.id);
    setEditVals({
      content: it.content,
      fileName: it.mediaFileName,
      visibleFrom: it.visibleFrom ? it.visibleFrom.slice(0, 16) : '',
      visibleUntil: it.visibleUntil ? it.visibleUntil.slice(0, 16) : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditVals(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editVals) return;
    if (!editVals.content.trim()) {
      toast.error(t('admin.comms.validation.content_required'));
      return;
    }
    if (editVals.visibleFrom && editVals.visibleUntil) {
      const vf = new Date(editVals.visibleFrom).getTime();
      const vu = new Date(editVals.visibleUntil).getTime();
      if (vu < vf) {
        toast.error(t('admin.comms.validation.date_order'));
        return;
      }
    }
    try {
      setUpdatingId(editingId);
      await api.put(`/communications/${editingId}` , {
        content: editVals.content.trim(),
        mediaFileName: editVals.fileName || undefined,
        visibleFrom: editVals.visibleFrom || undefined,
        visibleUntil: editVals.visibleUntil || undefined,
      });
      toast.success(t('admin.comms.update_success'));
      await loadItems(page);
      setEditingId(null);
      setEditVals(null);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      toast.error(msg ?? t('admin.comms.update_failed'));
    } finally {
      setUpdatingId(null);
    }
  };

  const openDeleteConfirm = (it: CommItem) => {
    setPendingDelete(it);
    setConfirmOpen(true);
  };

  const performDelete = async () => {
    const it = pendingDelete;
    if (!it) return;
    const prev = items.slice();
    setItems((curr) => curr.filter((c) => c.id !== it.id));
    try {
      await api.delete(`/communications/${it.id}`);
      toast.success(t('admin.comms.delete_success'));
      setPage(1);
      await loadItems(1);
    } catch (err: unknown) {
      setItems(prev);
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      toast.error(msg ?? t('admin.comms.delete_failed'));
    } finally {
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  if (loading) return <div>{t('admin.comms.loading')}</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 className="mt-3">{t('admin.comms.title')}</h2>
        <button className="btn btn-primary" type="button" onClick={openCreate}>{t('admin.comms.create_button')}</button>
      </div>

      {/* Barre de recherche */}
      <div className="flex wrap items-center gap-3 mt-2 mb-3 md:stack">
        <input
          type="text"
          placeholder={t('admin.comms.search_placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, minWidth: 220 }}
        />
      </div>

      {/* Liste */}
      {items.length === 0 ? (
        <div style={{ color: '#64748b' }}>{t('admin.comms.list_empty')}</div>
      ) : (
        <ul style={{ padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
          {items.map((c) => (
            <li key={c.id} className="tile" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
              {editingId === c.id && editVals ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <label>
                    <div>{t('admin.comms.field_content')}</div>
                    <textarea value={editVals.content} onChange={(e) => setEditVals((v) => v ? { ...v, content: e.target.value } : v)} rows={4} />
                  </label>
                  <label>
                    <div>{t('admin.comms.field_media')}</div>
                    <input type="text" value={editVals.fileName || ''} onChange={(e) => setEditVals((v) => v ? { ...v, fileName: e.target.value || null } : v)} placeholder={t('admin.comms.file_name_placeholder')} />
                    <div style={{ marginTop: 8 }}>
                      <FilePicker mode="inline" onSelect={onPickedEdit} />
                    </div>
                  </label>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                    <label>
                      <div>{t('admin.comms.field_visible_from')}</div>
                      <input type="datetime-local" value={editVals.visibleFrom} onChange={(e) => setEditVals((v) => v ? { ...v, visibleFrom: e.target.value } : v)} />
                    </label>
                    <label>
                      <div>{t('admin.comms.field_visible_until')}</div>
                      <input type="datetime-local" value={editVals.visibleUntil} onChange={(e) => setEditVals((v) => v ? { ...v, visibleUntil: e.target.value } : v)} />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-primary" disabled={updatingId === c.id} onClick={saveEdit}>{t('admin.comms.update')}</button>
                    <button type="button" className="btn btn-outline" onClick={cancelEdit}>{t('admin.comms.cancel')}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                  <div style={{ color: '#475569', fontSize: 12 }}>
                    {c.visibleFrom ? `${t('admin.comms.field_visible_from')}: ${new Date(c.visibleFrom).toLocaleString()}` : ''}
                    {c.visibleUntil ? ` — ${t('admin.comms.field_visible_until')}: ${new Date(c.visibleUntil).toLocaleString()}` : ''}
                  </div>
                  {c.mediaUrl && (
                    <div>
                      <a href={c.mediaUrl} target="_blank" rel="noreferrer">{t('common.open_in_new_tab')}</a>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => startEdit(c)}>{t('admin.comms.edit')}</button>
                    <button type="button" className="btn btn-danger" onClick={() => openDeleteConfirm(c)}>{t('admin.comms.delete')}</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pagination simple */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" disabled={page <= 1 || loading} onClick={async () => { const np = Math.max(1, page - 1); setPage(np); await loadItems(np); }}>{t('common.prev')}</button>
        <span>{t('admin.comms.page_label', { page, totalPages })}</span>
        <button className="btn" disabled={page >= totalPages || loading} onClick={async () => { const np = Math.min(totalPages, page + 1); setPage(np); await loadItems(np); }}>{t('common.next')}</button>
      </div>

      {/* Modal de création simple (custom) */}
      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: 10, padding: 16, width: 'min(860px, 92vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{t('admin.comms.modal_create_title')}</h3>
              <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>{t('admin.comms.cancel')}</button>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <label>
                <div>{t('admin.comms.field_content')}</div>
                <textarea rows={5} value={cContent} onChange={(e) => setCContent(e.target.value)} />
              </label>
              <label>
                <div>{t('admin.comms.field_media')}</div>
                <input type="text" placeholder={t('admin.comms.file_name_placeholder')} value={cFileName} onChange={(e) => setCFileName(e.target.value)} />
                <div style={{ marginTop: 8 }}>
                  <FilePicker mode="inline" onSelect={onPickedCreate} />
                </div>
              </label>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                <label>
                  <div>{t('admin.comms.field_visible_from')}</div>
                  <input type="datetime-local" value={cVisibleFrom} onChange={(e) => setCVisibleFrom(e.target.value)} />
                </label>
                <label>
                  <div>{t('admin.comms.field_visible_until')}</div>
                  <input type="datetime-local" value={cVisibleUntil} onChange={(e) => setCVisibleUntil(e.target.value)} />
                </label>
              </div>
              <div>
                <button className="btn btn-primary" disabled={!canSubmitCreate} onClick={submitCreate}>{creating ? t('admin.comms.creating') : t('admin.comms.create')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialogue de confirmation de suppression */}
      <ConfirmDialog
        open={confirmOpen}
        title={t('admin.comms.delete')}
        message={<span>{t('admin.comms.confirm_delete_text')}</span>}
        confirmLabel={t('admin.comms.delete')}
        cancelLabel={t('admin.comms.cancel')}
        onConfirm={performDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); }}
      />
    </div>
  );
};

export default AdminCommunicationsPage;

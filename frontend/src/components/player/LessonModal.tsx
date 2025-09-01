import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export type LessonRef = {
  _id: string;
  title: string;
  validationMode: 'read' | 'pro' | 'qcm';
};

export default function LessonModal({
  open,
  lesson,
  onClose,
  onMarked,
}: {
  open: boolean;
  lesson: LessonRef | null;
  onClose: () => void;
  onMarked?: () => void; // callback après "Marquer comme lu"
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [contents, setContents] = useState<Array<{ _id: string; contentType: 'image' | 'pdf' | 'mp4' | 'video' | 'doc'; fileName?: string; url?: string; caption?: string }>>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [lessonInfo, setLessonInfo] = useState<{ description?: string } | null>(null);

  // Type guard pour détecter une erreur d'annulation Axios/Abort sans utiliser `any`
  const isCanceled = (err: unknown): boolean => {
    if (typeof err === 'object' && err !== null) {
      if ('code' in err && (err as { code?: string }).code === 'ERR_CANCELED') return true;
      if ('name' in err && (err as { name?: string }).name === 'CanceledError') return true;
    }
    return false;
  };

  useEffect(() => {
    if (!open || !lesson) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        // Récupère d'abord les infos de la leçon
        const lessonRes = await api.get(`/lessons/${lesson._id}`, { signal: ctrl.signal });
        const info = (lessonRes?.data?.data ?? null) as { description?: string } | null;
        if (!ctrl.signal.aborted) setLessonInfo(info);
      } catch (err: unknown) {
        // Ignorer si la requête est annulée
        if (isCanceled(err)) return;
        setLessonInfo(null);
      }

      try {
        // Récupère ensuite les contenus, sans impacter la description en cas d'échec
        const contentsRes = await api.get(`/lessons/${lesson._id}/contents`, { signal: ctrl.signal });
        const arr = Array.isArray(contentsRes?.data?.data) ? contentsRes.data.data : [];
        if (!ctrl.signal.aborted) setContents(arr);
      } catch (err: unknown) {
        if (isCanceled(err)) return;
        setContents([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [open, lesson]);

  const handleMarkAsRead = async () => {
    if (!lesson || lesson.validationMode !== 'read') return;
    try {
      setActionLoading(true);
      await api.patch(`/progress/lessons/${lesson._id}/read`);
      if (onMarked) onMarked();
    } catch {
      // noop
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={lesson?.title || t('lessons.content')}>
      {loading ? (
        <div>{t('lessons.loading_content')}</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {lessonInfo?.description && (
            <div className="tile">
              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>{t('lessons.explanation')}</strong>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{lessonInfo.description}</div>
            </div>
          )}

          {contents.length === 0 && !lessonInfo?.description ? (
            <div className="tile">{t('lessons.no_content')}</div>
          ) : (
            contents.map((c) => (
              <div key={c._id} className="tile">
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 14 }}>{t(`lessons.content_type.${c.contentType}`)}</strong>
                </div>
                {/* Media + légende en 2 colonnes sur desktop, empilé en mobile lorsque la légende existe */}
                {c.caption ? (
                  <div className="grid grid-2 md:grid-1" style={{ gap: '0.75rem' }}>
                    <div>
                      {!c.url ? (
                        <div style={{ color: '#64748b', fontStyle: 'italic' }}>{t('lessons.no_content')}</div>
                      ) : c.contentType === 'image' ? (
                        <img src={c.url} alt={c.fileName || 'image'} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      ) : c.contentType === 'mp4' || c.contentType === 'video' ? (
                        <video controls src={c.url} style={{ width: '100%', maxHeight: 480, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      ) : c.contentType === 'pdf' || c.contentType === 'doc' ? (
                        <iframe title={c.fileName || 'pdf'} src={c.url} style={{ width: '100%', height: 520, border: 'none', borderRadius: 8 }} />
                      ) : (
                        <div style={{ color: '#64748b', fontStyle: 'italic' }}>Unsupported content type</div>
                      )}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{c.caption}</div>
                  </div>
                ) : (
                  <>
                    {!c.url ? (
                      <div style={{ color: '#64748b', fontStyle: 'italic' }}>{t('lessons.no_content')}</div>
                    ) : c.contentType === 'image' ? (
                      <img src={c.url} alt={c.fileName || 'image'} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    ) : c.contentType === 'mp4' || c.contentType === 'video' ? (
                      <video controls src={c.url} style={{ width: '100%', maxHeight: 480, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    ) : c.contentType === 'pdf' || c.contentType === 'doc' ? (
                      <iframe title={c.fileName || 'pdf'} src={c.url} style={{ width: '100%', height: 520, border: 'none', borderRadius: 8 }} />
                    ) : (
                      <div style={{ color: '#64748b', fontStyle: 'italic' }}>Unsupported content type</div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Actions selon validationMode */}
      {lesson?.validationMode === 'read' && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleMarkAsRead} disabled={actionLoading} className="btn btn-primary">
            {actionLoading ? t('loading') : t('lessons.mark_as_read')}
          </button>
        </div>
      )}

      {lesson?.validationMode === 'qcm' && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Link to={`/lessons/${lesson._id}/quiz`} className="btn btn-primary">{t('lessons.start_quiz')}</Link>
        </div>
      )}
    </Modal>
  );
}

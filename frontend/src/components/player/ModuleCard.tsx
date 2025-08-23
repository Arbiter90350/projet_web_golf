import { useTranslation } from 'react-i18next';
import LessonTile, { type LessonItem } from './LessonTile';
import StatusChip, { type LessonStatus } from './StatusChip';

export interface ModuleItem {
  id: string;
  title: string;
  description?: string;
}

export default function ModuleCard({
  module,
  moduleStatus,
  lessons,
  expanded,
  onToggle,
  getLessonStatus,
  onOpenLesson,
}: {
  module: ModuleItem;
  moduleStatus: LessonStatus;
  lessons: LessonItem[];
  expanded: boolean;
  onToggle: () => void;
  getLessonStatus: (lessonId: string) => LessonStatus;
  onOpenLesson: (lesson: LessonItem) => void;
}) {
  const { t } = useTranslation();
  const total = lessons?.length || 0;
  const completed = total === 0 ? 0 : lessons.filter((l) => getLessonStatus(l._id) === 'completed').length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 18 }}>{module.title}</strong>
            <StatusChip status={moduleStatus} />
          </div>
          {module.description && (
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{module.description}</div>
          )}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{t('lessons.count', { completed, total })}</span>
            <span>•</span>
            <span>{pct}%</span>
          </div>
        </div>
        <button onClick={onToggle} className="btn btn-primary">
          {expanded ? t('common.hide') : t('modules.show_lessons')}
        </button>
      </div>

      {/* Barre de progression */}
      <div style={{ marginTop: 10 }}>
        <div style={{ height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
          {[...(lessons || [])]
            .sort((a, b) => a.order - b.order)
            .map((l) => (
              <LessonTile key={l._id} lesson={l} status={getLessonStatus(l._id)} onOpen={onOpenLesson} />
            ))}
        </div>
      )}
    </div>
  );
}

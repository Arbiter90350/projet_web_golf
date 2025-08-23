import { useTranslation } from 'react-i18next';
import StatusChip, { type LessonStatus } from './StatusChip';

export type ValidationMode = 'read' | 'pro' | 'qcm';

export interface LessonItem {
  _id: string;
  title: string;
  order: number;
  validationMode: ValidationMode;
}

export default function LessonTile({
  lesson,
  status,
  onOpen,
}: {
  lesson: LessonItem;
  status: LessonStatus;
  onOpen: (lesson: LessonItem) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="tile"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{lesson.title}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{lesson.order}</span>
          <span className="badge badge-mode">
            {t(`lessons.validation.${lesson.validationMode}`)}
          </span>
          <StatusChip status={status} />
        </div>
      </div>
      <button onClick={() => onOpen(lesson)} className="btn btn-outline">
        {t('common.open')}
      </button>
    </div>
  );
}

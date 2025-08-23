import { useTranslation } from 'react-i18next';

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export default function StatusChip({ status }: { status: LessonStatus }) {
  const { t } = useTranslation();
  const map: Record<LessonStatus, { bg: string; fg: string; label: string }> = {
    not_started: { bg: '#e5e7eb', fg: '#374151', label: t('status.not_started') },
    in_progress: { bg: '#fde68a', fg: '#7c2d12', label: t('status.in_progress') },
    completed: { bg: '#bbf7d0', fg: '#065f46', label: t('status.completed') },
  } as const;
  const s = map[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: s.bg,
      color: s.fg,
      borderRadius: 999,
      border: '1px solid rgba(0,0,0,0.06)',
      padding: '0.2rem 0.55rem',
      fontSize: 12,
      lineHeight: 1,
      fontWeight: 600,
      letterSpacing: 0.2,
    }}>{s.label}</span>
  );
}

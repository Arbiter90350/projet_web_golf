import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string | number;
}

// Modal simple et accessible (rôle dialog, fermeture via Escape et clic backdrop)
export default function Modal({ open, onClose, title, children, width = 800 }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Modal'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)',
          width: typeof width === 'number' ? `${width}px` : width,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
          <strong style={{ color: 'var(--text-strong)' }}>{title}</strong>
          <button onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: '1rem' }}>{children}</div>
      </div>
    </div>
  );
}

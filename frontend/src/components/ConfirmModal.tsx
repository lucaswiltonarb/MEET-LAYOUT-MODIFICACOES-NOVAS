'use client';
import { useEffect } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string | null; // null = single-action modal (alert)
  variant?: 'danger' | 'info' | 'success';
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * Drop-in replacement for window.alert / window.confirm with a styled modal.
 * - Pass `cancelLabel={null}` to render a single OK button (alert-style).
 */
const ConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const colorMap = {
    danger: { bg: 'bg-red-600', hover: 'hover:bg-red-700', ring: 'ring-red-500/40' },
    info: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', ring: 'ring-blue-500/40' },
    success: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', ring: 'ring-emerald-500/40' },
  }[variant];

  return (
    <div
      data-testid="confirm-modal-backdrop"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      <div
        data-testid="confirm-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl"
        style={{ maxWidth: 440, width: '100%', animation: 'popIn 180ms cubic-bezier(.4,.2,.2,1)' }}
      >
        <div className="px-6 pt-5 pb-4">
          <h3 className="text-white text-lg font-medium" data-testid="confirm-modal-title">{title}</h3>
          {message && (
            <div className="mt-2 text-slate-300 text-sm leading-relaxed" data-testid="confirm-modal-message">
              {message}
            </div>
          )}
        </div>
        <div className="px-5 pb-5 pt-2 flex items-center justify-end gap-2">
          {cancelLabel !== null && (
            <button
              data-testid="confirm-modal-cancel"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
            >
              {cancelLabel}
            </button>
          )}
          <button
            data-testid="confirm-modal-confirm"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${colorMap.bg} ${colorMap.hover} focus:outline-none focus:ring-2 ${colorMap.ring}`}
          >
            {confirmLabel}
          </button>
        </div>
        <style jsx>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes popIn { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
        `}</style>
      </div>
    </div>
  );
};

export default ConfirmModal;

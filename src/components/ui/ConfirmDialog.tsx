'use client';

import { useEffect } from 'react';
import { Button } from './Button';
import clsx from 'clsx';

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Ya',
  cancelLabel = 'Batal',
  variant = 'primary',
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleConfirm() {
    await onConfirm();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={clsx(
          'relative w-full max-w-md rounded-2xl border shadow-2xl',
          'border-slate-700/80 bg-slate-900/95 ring-1 ring-slate-600/30',
          'p-6',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Memproses…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

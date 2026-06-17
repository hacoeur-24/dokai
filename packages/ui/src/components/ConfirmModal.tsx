import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { useT } from '../i18n/index.js';

export type ConfirmTone = 'default' | 'destructive';

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /**
   * Async confirm handler. The modal stays open and shows a busy state while this resolves.
   * If it throws, the error message is shown inside the modal and the modal stays open so the
   * user can retry or cancel.
   */
  onConfirm: () => Promise<void> | void;
}

/**
 * Generic confirmation dialog. Centered overlay, focus-trapped. Enter triggers confirm,
 * Esc triggers cancel (which only closes the modal — caller's draft state is untouched).
 */
export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  onConfirm,
}: ConfirmModalProps) {
  const t = useT();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedConfirm = confirmLabel ?? t('common.ok');
  const resolvedCancel = cancelLabel ?? t('common.cancel');

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
      // Focus the confirm button so Enter triggers it (per "ok being the default answer").
      const id = window.requestAnimationFrame(() => confirmRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, busy, onOpenChange]);

  if (!open) return null;

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[18vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dokai-confirm-title"
      onClick={() => !busy && onOpenChange(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-card border bg-bg"
        style={{ boxShadow: 'var(--shadow-pop)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <div
              className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-control')}
              style={
                tone === 'destructive'
                  ? {
                      background: 'color-mix(in oklch, var(--color-danger) 14%, transparent)',
                      color: 'var(--color-danger)',
                    }
                  : {
                      background: 'color-mix(in oklch, var(--color-accent) 14%, transparent)',
                      color: 'var(--color-accent)',
                    }
              }
            >
              {tone === 'destructive' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </div>
            <h2 id="dokai-confirm-title" className="pt-1.5 text-base font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="dokai-icon-button"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {description && (
          <div className="px-5 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
            {description}
          </div>
        )}

        {error && (
          <div
            className="mx-5 mt-3 rounded-control border px-3 py-2 text-xs"
            style={{
              color: 'var(--color-danger)',
              borderColor: 'var(--color-danger)',
            }}
          >
            {error}
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 px-5 pb-5 pt-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-control border px-3 py-1.5 text-sm hover:bg-bg-muted disabled:opacity-50"
          >
            {resolvedCancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => void handleConfirm()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) {
                e.preventDefault();
                void handleConfirm();
              }
            }}
            disabled={busy}
            className="rounded-control px-4 py-1.5 text-sm font-medium disabled:opacity-50"
            style={
              tone === 'destructive'
                ? { background: 'var(--color-danger)', color: 'white' }
                : {
                    background: 'var(--color-accent)',
                    color: 'var(--color-accent-fg)',
                  }
            }
          >
            {busy ? t('common.working') : resolvedConfirm}
          </button>
        </footer>
      </div>
    </div>
  );
}

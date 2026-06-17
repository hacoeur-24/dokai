import { useEffect, useRef, useState } from 'react';
import { X, FileEdit } from 'lucide-react';
import { useT } from '../i18n/index.js';

export interface RenameDocModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current relativePath inside DOKAI/ (e.g. "architecture/overview.md"). */
  currentRelativePath: string;
  /** Async rename handler. The modal stays open and shows a busy state while this resolves;
   *  if it throws, the error is rendered inline so the user can fix and retry. */
  onRename: (newRelativePath: string) => Promise<void>;
}

/**
 * Rename / move dialog for a document. Single text input pre-filled with the current
 * relativePath; the user edits and submits. Supports moving across folders by typing a path
 * with forward slashes (e.g. `engineering/overview.md`).
 */
export function RenameDocModal({
  open,
  onOpenChange,
  currentRelativePath,
  onRename,
}: RenameDocModalProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(currentRelativePath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentRelativePath);
      setBusy(false);
      setError(null);
      // Focus + select-all-without-extension so the user can immediately start typing.
      const id = window.requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        const dot = currentRelativePath.lastIndexOf('.');
        const slash = currentRelativePath.lastIndexOf('/');
        const start = slash >= 0 ? slash + 1 : 0;
        const end = dot > slash ? dot : currentRelativePath.length;
        el.setSelectionRange(start, end);
      });
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, [open, currentRelativePath]);

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

  const trimmed = value.trim();
  const unchanged = trimmed === currentRelativePath;
  const invalid = !trimmed || !trimmed.endsWith('.md');

  const handleConfirm = async (): Promise<void> => {
    if (unchanged) {
      onOpenChange(false);
      return;
    }
    if (invalid) {
      setError(t('rename.requiresMd'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(trimmed);
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
      aria-labelledby="dokai-rename-title"
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
              className="grid h-9 w-9 shrink-0 place-items-center rounded-control"
              style={{
                background: 'color-mix(in oklch, var(--color-accent) 14%, transparent)',
                color: 'var(--color-accent)',
              }}
            >
              <FileEdit className="h-4 w-4" />
            </div>
            <h2 id="dokai-rename-title" className="pt-1.5 text-base font-semibold tracking-tight">
              {t('rename.title')}
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

        <div className="space-y-2 px-5 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          <p>{t('rename.body')}</p>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) {
                e.preventDefault();
                void handleConfirm();
              }
            }}
            placeholder={t('rename.placeholder')}
            spellCheck={false}
            className="dokai-control font-mono"
          />
          <p className="text-xs" style={{ color: 'var(--color-fg-subtle)' }}>
            {t('rename.hint')}
          </p>
        </div>

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
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || invalid}
            className="rounded-control px-4 py-1.5 text-sm font-medium disabled:opacity-50"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
            }}
          >
            {busy ? t('common.renaming') : unchanged ? t('common.noChange') : t('common.rename')}
          </button>
        </footer>
      </div>
    </div>
  );
}

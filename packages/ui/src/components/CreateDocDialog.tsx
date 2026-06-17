import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { createDoc } from '../lib/api.js';
import { useRefresh } from '../state.js';
import { useT } from '../i18n/index.js';

export function CreateDocDialog({
  open,
  onOpenChange,
  initialFolder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-fill the folder field. Used when the user clicks `+` next to a sidebar section. */
  initialFolder?: string;
}) {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const t = useT();

  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState(initialFolder ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFolder(initialFolder ?? '');
      setTitle('');
      setError(null);
      setBusy(false);
    }
  }, [open, initialFolder]);

  if (!open) return null;

  const handleCreate = async (): Promise<void> => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const slug = slugify(title);
      const folderPart = folder.trim().replace(/^\/+|\/+$/g, '');
      const route = folderPart ? `/dokai/${folderPart}/${slug}` : `/dokai/${slug}`;
      const result = await createDoc(route, { title });
      refresh();
      onOpenChange(false);
      navigate(`${result.route}?edit=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[18vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-card border bg-bg"
        style={{ boxShadow: 'var(--shadow-pop)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t('layout.newDoc')}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 hover:bg-bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 px-4 py-4">
          <Field label={`Folder (${t('common.optional')})`}>
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="backend"
              className={inputCls}
            />
            <p className="mt-1 text-[0.7rem]" style={{ color: 'var(--color-fg-subtle)' }}>
              Path under DOKAI/. Leave blank for top level.
            </p>
          </Field>
          <Field label={t('frontmatter.title')}>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="API endpoints"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              className={inputCls}
            />
          </Field>
          {title.trim() && (
            <p className="text-[0.72rem]" style={{ color: 'var(--color-fg-subtle)' }}>
              Will create{' '}
              <span className="font-mono">
                DOKAI/{folder ? `${folder}/` : ''}
                {slugify(title)}.md
              </span>
            </p>
          )}
          {error && (
            <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t bg-bg-subtle px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-control border px-3 py-1.5 text-sm hover:bg-bg-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !title.trim()}
            className="rounded-control px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
            }}
          >
            {busy ? t('common.working') : t('create.confirm')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  );
}

const inputCls =
  'w-full rounded-[var(--radius-control)] border bg-[var(--color-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

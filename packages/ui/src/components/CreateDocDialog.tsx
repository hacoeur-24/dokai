import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { createDoc, createFolder } from '../lib/api.js';
import { useManifest, useRefresh } from '../state.js';
import { useT } from '../i18n/index.js';
import { Dropdown } from './Dropdown.js';
import { flattenFolders } from '../lib/tree.js';

export function CreateDocDialog({
  open,
  onOpenChange,
  initialFolder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-fill the folder location. Used when the user clicks `+` next to a sidebar section. */
  initialFolder?: string;
}) {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const manifest = useManifest();
  const t = useT();

  const [kind, setKind] = useState<'document' | 'folder'>('document');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState<string>(initialFolder ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setKind('document');
      setLocation(initialFolder ?? '');
      setTitle('');
      setError(null);
      setBusy(false);
    }
  }, [open, initialFolder]);

  if (!open) return null;

  // Build location options: Root + every folder in the tree
  const folders = manifest.data?.tree ? flattenFolders(manifest.data.tree) : [];
  const locationOptions = [
    { label: t('create.locationRoot'), value: '' },
    ...folders.map((f) => ({
      label: '  '.repeat(f.depth) + (f.path.split('/').pop() ?? f.path),
      value: f.path,
    })),
  ];

  const handleCreate = async (): Promise<void> => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const slug = slugify(title);
      if (kind === 'document') {
        const folderPart = location.trim().replace(/^\/+|\/+$/g, '');
        const route = folderPart ? `/dokai/${folderPart}/${slug}` : `/dokai/${slug}`;
        const result = await createDoc(route, { title });
        refresh();
        onOpenChange(false);
        navigate(`${result.route}?edit=1`);
      } else {
        // folder branch: build relative path from location + slug, then create
        const folderPart = location.trim().replace(/^\/+|\/+$/g, '');
        const relativePath = folderPart ? `${folderPart}/${slug}` : slug;
        await createFolder(relativePath, { title });
        refresh();
        onOpenChange(false);
        // intentionally no navigate() — folders have no editor route
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const titleLabel = kind === 'folder' ? t('create.folderName') : t('frontmatter.title');
  const dialogTitle = kind === 'folder' ? t('create.titleFolder') : t('create.title');

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
          <h2 className="text-sm font-semibold">{dialogTitle}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 hover:bg-bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 px-4 py-4">
          {/* Kind switcher: Document | Folder */}
          <div className="flex rounded-[var(--radius-control)] border overflow-hidden">
            <button
              type="button"
              onClick={() => setKind('document')}
              className={[
                'flex-1 px-3 py-1.5 text-sm font-medium transition',
                kind === 'document'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                  : 'bg-[var(--color-bg)] hover:bg-[var(--color-bg-muted)]',
              ].join(' ')}
            >
              {t('create.kindDocument')}
            </button>
            <button
              type="button"
              onClick={() => setKind('folder')}
              className={[
                'flex-1 px-3 py-1.5 text-sm font-medium transition border-l',
                kind === 'folder'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                  : 'bg-[var(--color-bg)] hover:bg-[var(--color-bg-muted)]',
              ].join(' ')}
            >
              {t('create.kindFolder')}
            </button>
          </div>

          {/* Location dropdown */}
          <Field label={t('create.location')}>
            <Dropdown
              value={location}
              options={locationOptions}
              onChange={(v) => setLocation(v)}
              fullWidth
            />
          </Field>

          {/* Name / Title input */}
          <Field label={titleLabel}>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'folder' ? t('create.folderPlaceholder') : t('create.docNamePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              className={inputCls}
            />
          </Field>

          {title.trim() && kind === 'document' && (
            <p className="text-[0.72rem]" style={{ color: 'var(--color-fg-subtle)' }}>
              {t('create.pathPreview')}{' '}
              <span className="font-mono">
                DOKAI/{location ? `${location}/` : ''}
                {slugify(title)}.md
              </span>
            </p>
          )}
          {title.trim() && kind === 'folder' && (
            <p className="text-[0.72rem]" style={{ color: 'var(--color-fg-subtle)' }}>
              {t('create.pathPreview')}{' '}
              <span className="font-mono">
                DOKAI/{location ? `${location}/` : ''}
                {slugify(title)}/
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

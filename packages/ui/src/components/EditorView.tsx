import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, X, Trash2, BookOpen, ArrowRight, FileEdit } from 'lucide-react';
import type { DocNode, Frontmatter } from 'dokai-core';
import { deleteDoc, fetchDoc, renameDoc, saveDoc } from '../lib/api.js';
import { EditorPane } from './EditorPane.js';
import { FrontmatterForm } from './FrontmatterForm.js';
import { ConfirmModal } from './ConfirmModal.js';
import { RenameDocModal } from './RenameDocModal.js';
import { useToast } from './Toast.js';
import { useRefresh } from '../state.js';
import { safeRolloverBump } from '../lib/version.js';
import { useT } from '../i18n/index.js';

export function EditorView() {
  const params = useParams<{ '*': string }>();
  const subpath = params['*'] ?? '';
  const route = subpath ? `/dokai/${subpath}` : '/dokai';
  const navigate = useNavigate();
  const refresh = useRefresh();
  const toast = useToast();
  const t = useT();

  const [doc, setDoc] = useState<DocNode | null>(null);
  const [draftFm, setDraftFm] = useState<Frontmatter | null>(null);
  const [draftBody, setDraftBody] = useState<string>('');
  /** The version stored on disk at the moment of last load/save. Compared against `draftFm.version`
   *  to decide whether the user manually changed the version (no auto-bump) or not (auto-bump). */
  const [originalVersion, setOriginalVersion] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'dirty'>('idle');

  const [saveOpen, setSaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    setError(null);
    setDoc(null);
    setDraftFm(null);
    fetchDoc(route)
      .then((d) => {
        setDoc(d);
        setDraftFm(d.frontmatter);
        setDraftBody(d.bodyMarkdown);
        setOriginalVersion(d.frontmatter.version);
        setStatus('idle');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [route]);

  /** True when the user changed the version field manually since the last save/load. */
  const versionChangedManually = !!draftFm && draftFm.version !== originalVersion;
  /** What the version will be after Save: user's value if they edited it, else the rollover bump. */
  const proposedVersion = (() => {
    if (!draftFm) return '';
    if (versionChangedManually) return draftFm.version;
    return safeRolloverBump(draftFm.version) ?? draftFm.version;
  })();

  const performSave = async (): Promise<void> => {
    if (!draftFm) return;
    const nextFm: Frontmatter = { ...draftFm, version: proposedVersion };
    setDraftFm(nextFm);
    setStatus('saving');
    try {
      await saveDoc(route, { frontmatter: nextFm, bodyMarkdown: draftBody });
      setOriginalVersion(nextFm.version);
      setStatus('saved');
      setSaveOpen(false);
      refresh();
      toast.show({ message: t('save.docSaved'), kind: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('dirty');
      throw err; // surface to the modal so it can show the error
    }
  };

  const performDelete = async (): Promise<void> => {
    try {
      await deleteDoc(route);
      setDeleteOpen(false);
      refresh();
      navigate('/dokai');
      toast.show({ message: t('delete.docDeleted'), kind: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  const performRename = async (newRelativePath: string): Promise<void> => {
    const result = await renameDoc(route, newRelativePath);
    setRenameOpen(false);
    refresh();
    // Stay in edit mode at the new route so the user keeps their session.
    navigate(`${result.route}?edit=1`);
    toast.show({ message: t('rename.docRenamed'), kind: 'success' });
  };

  if (error && !doc) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Couldn't load document</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          {error}
        </p>
      </div>
    );
  }
  if (!doc || !draftFm) {
    return <div className="h-40 w-full animate-pulse rounded bg-bg-muted" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="dokai-eyebrow">{t('editor.editing', { path: doc.relativePath })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{draftFm.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={route}
            className="inline-flex items-center gap-1.5 rounded-control border bg-(--color-surface) px-3 py-1.5 text-sm transition hover:bg-surface-hover"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t('common.view')}
          </Link>
          <button
            type="button"
            onClick={() => navigate(route)}
            className="inline-flex items-center gap-1.5 rounded-control border bg-(--color-surface) px-3 py-1.5 text-sm transition hover:bg-surface-hover"
          >
            <X className="h-3.5 w-3.5" />
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => setRenameOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-control border bg-(--color-surface) px-3 py-1.5 text-sm transition hover:bg-surface-hover"
          >
            <FileEdit className="h-3.5 w-3.5" />
            {t('common.rename')}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-control border bg-(--color-surface) px-3 py-1.5 text-sm transition hover:bg-surface-hover"
            style={{ color: 'var(--color-danger)' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete')}
          </button>
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            disabled={status === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition disabled:opacity-50"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
            }}
          >
            <Save className="h-3.5 w-3.5" />
            {status === 'saving'
              ? t('common.saving')
              : status === 'saved'
                ? t('common.saved')
                : t('common.save')}
          </button>
        </div>
      </header>

      <FrontmatterForm value={draftFm} onChange={setDraftFm} defaultCollapsed />

      <EditorPane
        route={route}
        initial={draftBody}
        onChange={(next) => {
          setDraftBody(next);
          if (status !== 'dirty') setStatus('dirty');
        }}
      />

      <ConfirmModal
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title={t('save.title')}
        confirmLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onConfirm={performSave}
        description={
          <SaveConfirmBody
            current={draftFm.version}
            proposed={proposedVersion}
            manuallyChanged={versionChangedManually}
            originalVersion={originalVersion}
          />
        }
      />

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('delete.title')}
        tone="destructive"
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={performDelete}
        description={
          <p>
            {/* The body string is a single sentence that mentions the file path inline. We
                interpolate the path with a `<code>` wrapper for visual emphasis; the surrounding
                prose comes from i18n. We split on a sentinel to insert the styled <code>. */}
            {(() => {
              const parts = t('delete.body', {
                path: '\u0000PATH\u0000',
              }).split('\u0000PATH\u0000');
              return (
                <>
                  {parts[0]}
                  <code className="font-mono text-fg">{doc.relativePath}</code>
                  {parts[1] ?? ''}
                </>
              );
            })()}
          </p>
        }
      />

      <RenameDocModal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentRelativePath={doc.relativePath}
        onRename={performRename}
      />
    </div>
  );
}

function SaveConfirmBody({
  current,
  proposed,
  manuallyChanged,
  originalVersion,
}: {
  current: string;
  proposed: string;
  manuallyChanged: boolean;
  originalVersion: string;
}) {
  const t = useT();
  if (manuallyChanged) {
    return (
      <div className="space-y-2">
        <p>{t('save.versionManual', { current })}</p>
        <p className="text-xs" style={{ color: 'var(--color-fg-subtle)' }}>
          {t('save.versionPrevious', { previous: originalVersion || '—' })}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p>{t('save.versionUnchanged')}</p>
      <p
        className="inline-flex items-center gap-2 rounded-control border bg-bg-subtle px-3 py-2 text-[0.85rem]"
        style={{ color: 'var(--color-fg)' }}
      >
        <code className="font-mono">{current}</code>
        <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--color-fg-subtle)' }} />
        <code className="font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>
          {proposed}
        </code>
      </p>
      <p className="text-xs" style={{ color: 'var(--color-fg-subtle)' }}>
        {t('save.versionEditHint')}
      </p>
    </div>
  );
}

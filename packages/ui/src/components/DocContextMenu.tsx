import { useState, type ReactNode } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Pencil, Download, Trash2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal.js';
import { useToast } from './Toast.js';
import { deleteDoc } from '../lib/api.js';
import { downloadDoc } from '../lib/download.js';
import { useRefresh, useSettings } from '../state.js';
import { useT } from '../i18n/index.js';

export interface DocContextMenuProps {
  /** Doc route (e.g. `/dokai/backend/api`). */
  route: string;
  /** Path inside DOKAI/ (e.g. `backend/api.md`) — used for the delete dialog message. */
  relativePath: string;
  /** The clickable child the right-click is anchored to (typically the sidebar NavLink). */
  children: ReactNode;
}

/**
 * Right-click menu for a sidebar document row. Mounts the four actions
 * (Open / Edit / Download / Delete) in a Radix context menu portal.
 */
export function DocContextMenu({ route, relativePath, children }: DocContextMenuProps) {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const settings = useSettings();
  const toast = useToast();
  const t = useT();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDownload = (): void => {
    const format = settings.data?.project.downloads.defaultFormat ?? 'markdown';
    if (format === 'pdf') {
      void toast.promise(downloadDoc({ route, relativePath, format }), {
        loading: t('doc.downloadingPdf'),
        success: t('doc.pdfDownloaded'),
        error: (err) =>
          t('doc.pdfFailed', {
            error: err instanceof Error ? err.message : String(err),
          }),
      });
    } else {
      void downloadDoc({ route, relativePath, format }).catch((err: unknown) => {
        toast.show({
          message: t('doc.downloadFailed', {
            error: err instanceof Error ? err.message : String(err),
          }),
          kind: 'error',
        });
      });
    }
  };

  const handleDelete = async (): Promise<void> => {
    await deleteDoc(route);
    setDeleteOpen(false);
    refresh();
    navigate('/dokai');
    toast.show({ message: t('delete.docDeleted'), kind: 'success' });
  };

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content collisionPadding={8} className="dokai-context-menu min-w-40">
            <ContextMenu.Item className="dokai-context-item" onSelect={() => navigate(route)}>
              <BookOpen className="h-3.5 w-3.5" />
              {t('context.open')}
            </ContextMenu.Item>
            <ContextMenu.Item
              className="dokai-context-item"
              onSelect={() => navigate(`${route}?edit=1`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('context.edit')}
            </ContextMenu.Item>
            <ContextMenu.Item className="dokai-context-item" onSelect={handleDownload}>
              <Download className="h-3.5 w-3.5" />
              {t('context.download')}
            </ContextMenu.Item>
            <ContextMenu.Separator className="dokai-context-separator" />
            <ContextMenu.Item
              className="dokai-context-item dokai-context-item--danger"
              onSelect={(e) => {
                // Prevent Radix from auto-closing before the modal opens; we handle close
                // ourselves via the modal's onOpenChange.
                e.preventDefault();
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('context.delete')}
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('delete.title')}
        tone="destructive"
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDelete}
        description={
          <p>
            {(() => {
              const parts = t('delete.body', {
                path: '\u0000PATH\u0000',
              }).split('\u0000PATH\u0000');
              return (
                <>
                  {parts[0]}
                  <code className="font-mono text-fg">{relativePath}</code>
                  {parts[1] ?? ''}
                </>
              );
            })()}
          </p>
        }
      />
    </>
  );
}

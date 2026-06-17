import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Download, FileCode2, FileText } from 'lucide-react';
import { downloadDoc, type DownloadFormat } from '../lib/download.js';
import { useSettings } from '../state.js';
import { useToast } from './Toast.js';
import { useT } from '../i18n/index.js';

/**
 * In-doc download dropdown: clicking the trigger opens a small menu offering Markdown or PDF.
 * The user's project default is highlighted (subtle accent), and clicking either entry
 * downloads in that format immediately.
 */
export function DownloadDropdown({ route, relativePath }: { route: string; relativePath: string }) {
  const settings = useSettings();
  const toast = useToast();
  const t = useT();
  const defaultFormat: DownloadFormat =
    settings.data?.project.downloads.defaultFormat ?? 'markdown';

  const trigger = (format: DownloadFormat): void => {
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

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title={t('common.download')}
          aria-label={t('common.download')}
          className="dokai-icon-button h-8.5 w-8.5"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="dokai-dropdown-menu">
          <DropdownMenu.Item
            className="dokai-dropdown-item"
            onSelect={() => trigger('markdown')}
            data-default={defaultFormat === 'markdown' ? 'true' : undefined}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span className="flex-1">{t('doc.downloadFormatMarkdown')}</span>
            {defaultFormat === 'markdown' && (
              <span
                className="text-[0.65rem] font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-accent)' }}
              >
                {t('common.default')}
              </span>
            )}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dokai-dropdown-item"
            onSelect={() => trigger('pdf')}
            data-default={defaultFormat === 'pdf' ? 'true' : undefined}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="flex-1">{t('doc.downloadFormatPdf')}</span>
            {defaultFormat === 'pdf' && (
              <span
                className="text-[0.65rem] font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-accent)' }}
              >
                {t('common.default')}
              </span>
            )}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

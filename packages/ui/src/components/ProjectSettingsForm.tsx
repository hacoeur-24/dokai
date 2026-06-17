import { useState, type ReactNode } from 'react';
import {
  FolderCog,
  Image as ImageIcon,
  Palette,
  Tag as TagIcon,
  Check,
  AlertCircle,
  SunMoon,
  Droplet,
  Square,
  Download,
  FileType2,
} from 'lucide-react';
import type { ProjectSettings } from 'dokai-core';
import { saveProjectSettings } from '../lib/api.js';
import { useRefresh } from '../state.js';
import { useToast } from './Toast.js';
import { useT } from '../i18n/index.js';

export function ProjectSettingsForm({ initial }: { initial: ProjectSettings }) {
  const refresh = useRefresh();
  const toast = useToast();
  const t = useT();
  const [draft, setDraft] = useState<ProjectSettings>(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<ProjectSettings>): void => {
    setDraft((d) => ({ ...d, ...patch }));
    setStatus('idle');
  };

  const updateNested = <K extends keyof ProjectSettings>(
    key: K,
    patch: Partial<ProjectSettings[K]>,
  ): void => {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as object), ...patch } }));
    setStatus('idle');
  };

  const handleSave = async (): Promise<void> => {
    setStatus('saving');
    setError(null);
    try {
      await saveProjectSettings(draft);
      setStatus('saved');
      refresh();
      toast.show({ message: t('settings.project.saved'), kind: 'success' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      setStatus('idle');
      toast.show({
        message: t('settings.project.saveFailed', { error: errMsg }),
        kind: 'error',
      });
    }
  };

  return (
    <section
      className="flex h-full flex-col rounded-[var(--radius-card)] border bg-[var(--color-surface)]"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)]"
            style={{
              background: 'color-mix(in oklch, var(--color-accent) 14%, transparent)',
              color: 'var(--color-accent)',
            }}
          >
            <FolderCog className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">
              {t('settings.project.title')}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              {t('settings.project.subtitle', { file: '' })}
              <code className="font-mono">DOKAI/settings.json</code>
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-7 px-5 py-6">
        <Field icon={<TagIcon className="h-3.5 w-3.5" />} label={t('settings.project.projectName')}>
          <input
            type="text"
            value={draft.projectName}
            onChange={(e) => update({ projectName: e.target.value })}
            className="dokai-control"
          />
        </Field>

        <Field
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label={t('settings.project.logo', { optional: t('common.optional') })}
        >
          <input
            type="text"
            value={draft.logo ?? ''}
            onChange={(e) => update({ logo: e.target.value || undefined })}
            placeholder="/public/logo.svg"
            className="dokai-control"
          />
          <p className="mt-1.5 text-[0.7rem]" style={{ color: 'var(--color-fg-subtle)' }}>
            <code className="font-mono">./foo</code> → relative to{' '}
            <code className="font-mono">DOKAI/</code> · <code className="font-mono">/foo</code> →
            relative to the repo root · <code className="font-mono">https://…</code> → external URL
          </p>
        </Field>

        <Group icon={<Palette className="h-3.5 w-3.5" />} title={t('settings.project.theme')}>
          <div className="grid grid-cols-3 items-end gap-3">
            <Field
              icon={<SunMoon className="h-3.5 w-3.5" />}
              label={t('settings.project.themeMode')}
            >
              <select
                value={draft.theme.defaultMode}
                onChange={(e) =>
                  updateNested('theme', {
                    defaultMode: e.target.value as ProjectSettings['theme']['defaultMode'],
                  })
                }
                className="dokai-control"
              >
                <option value="system">{t('themeMode.system')}</option>
                <option value="light">{t('themeMode.light')}</option>
                <option value="dark">{t('themeMode.dark')}</option>
              </select>
            </Field>
            <Field
              icon={<Droplet className="h-3.5 w-3.5" />}
              label={t('settings.project.themePrimary')}
            >
              <input
                type="color"
                value={draft.theme.primaryColor}
                onChange={(e) => updateNested('theme', { primaryColor: e.target.value })}
                className="dokai-control"
              />
            </Field>
            <Field
              icon={<Square className="h-3.5 w-3.5" />}
              label={t('settings.project.themeRadius')}
            >
              <select
                value={draft.theme.radius}
                onChange={(e) =>
                  updateNested('theme', {
                    radius: e.target.value as ProjectSettings['theme']['radius'],
                  })
                }
                className="dokai-control"
              >
                <option value="none">{t('radius.none')}</option>
                <option value="small">{t('radius.small')}</option>
                <option value="medium">{t('radius.medium')}</option>
                <option value="large">{t('radius.large')}</option>
              </select>
            </Field>
          </div>
        </Group>

        <Group icon={<Download className="h-3.5 w-3.5" />} title={t('settings.project.downloads')}>
          <Field
            icon={<FileType2 className="h-3.5 w-3.5" />}
            label={t('settings.project.defaultFormat')}
          >
            <select
              value={draft.downloads.defaultFormat}
              onChange={(e) =>
                updateNested('downloads', {
                  defaultFormat: e.target.value as ProjectSettings['downloads']['defaultFormat'],
                })
              }
              className="dokai-control"
            >
              <option value="markdown">{t('downloadFormat.markdown')}</option>
              <option value="pdf">{t('downloadFormat.pdf')}</option>
            </select>
            <p className="mt-1.5 text-[0.7rem]" style={{ color: 'var(--color-fg-subtle)' }}>
              {t('settings.project.defaultFormatHint')}
            </p>
          </Field>
        </Group>
      </div>

      <footer className="flex items-center justify-between gap-3 px-5 pb-5">
        {error ? (
          <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {status === 'saved' && (
            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--color-success)' }}
            >
              <Check className="h-3.5 w-3.5" />
              {t('common.saved')}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={status === 'saving'}
            className="rounded-[var(--radius-control)] px-4 py-1.5 text-sm font-medium transition disabled:opacity-50"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
            }}
          >
            {status === 'saving' ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </footer>
    </section>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function Group({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div
        className="dokai-eyebrow mb-5 flex items-center gap-3"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        <span className="flex shrink-0 items-center gap-1.5">
          {icon}
          {title}
        </span>
        <span
          aria-hidden="true"
          className="h-px flex-1"
          style={{ background: 'var(--color-border)' }}
        />
      </div>
      {children}
    </div>
  );
}

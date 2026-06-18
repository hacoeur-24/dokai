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
  Link,
} from 'lucide-react';
import type { ProjectSettings } from 'dokai-core';
import { saveProjectSettings } from '../lib/api.js';
import { useRefresh } from '../state.js';
import { useToast } from './Toast.js';
import { useT } from '../i18n/index.js';
import { Dropdown } from './Dropdown.js';
import { InfoTip } from './InfoTip.js';

const LOGO_SNIPPETS: Record<string, string> = {
  relativePrefix: './foo',
  folder: 'DOKAI/',
  absolutePrefix: '/foo',
  urlPrefix: 'https://…',
};

function renderHintWithCode(template: string): ReactNode {
  return template
    .split(/(\{relativePrefix\}|\{folder\}|\{absolutePrefix\}|\{urlPrefix\})/g)
    .map((part, i) => {
      const m = /^\{(\w+)\}$/.exec(part);
      const snippet = m ? LOGO_SNIPPETS[m[1] ?? ''] : undefined;
      return snippet ? (
        <code key={i} className="font-mono">
          {snippet}
        </code>
      ) : (
        <span key={i}>{part}</span>
      );
    });
}

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
          help={<span>{renderHintWithCode(t('settings.project.logoHint'))}</span>}
        >
          <input
            type="text"
            value={draft.logo ?? ''}
            onChange={(e) => update({ logo: e.target.value || undefined })}
            placeholder="/public/logo.svg"
            className="dokai-control"
          />
        </Field>

        <Field
          icon={<Link className="h-3.5 w-3.5" />}
          label={t('settings.project.githubUrl')}
          help={t('settings.project.githubUrlHint')}
        >
          <input
            type="url"
            value={draft.githubUrl ?? ''}
            onChange={(e) => update({ githubUrl: e.target.value || undefined })}
            placeholder="https://github.com/org/repo"
            className="dokai-control"
          />
        </Field>

        <Field
          icon={<Link className="h-3.5 w-3.5" />}
          label={t('settings.project.appUrl')}
          help={t('settings.project.appUrlHint')}
        >
          <input
            type="url"
            value={draft.appUrl ?? ''}
            onChange={(e) => update({ appUrl: e.target.value || undefined })}
            placeholder="https://app.example.com"
            className="dokai-control"
          />
        </Field>

        <Group icon={<Palette className="h-3.5 w-3.5" />} title={t('settings.project.theme')}>
          <div className="grid grid-cols-3 items-end gap-3">
            <Field
              icon={<SunMoon className="h-3.5 w-3.5" />}
              label={t('settings.project.themeMode')}
            >
              <Dropdown<ProjectSettings['theme']['defaultMode']>
                fullWidth
                value={draft.theme.defaultMode}
                options={[
                  { value: 'system', label: t('themeMode.system') },
                  { value: 'light', label: t('themeMode.light') },
                  { value: 'dark', label: t('themeMode.dark') },
                ]}
                onChange={(v) => updateNested('theme', { defaultMode: v })}
              />
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
              <Dropdown<ProjectSettings['theme']['radius']>
                fullWidth
                value={draft.theme.radius}
                options={[
                  { value: 'none', label: t('radius.none') },
                  { value: 'small', label: t('radius.small') },
                  { value: 'medium', label: t('radius.medium') },
                  { value: 'large', label: t('radius.large') },
                ]}
                onChange={(v) => updateNested('theme', { radius: v })}
              />
            </Field>
          </div>
        </Group>

        <Group icon={<Download className="h-3.5 w-3.5" />} title={t('settings.project.downloads')}>
          <Field
            icon={<FileType2 className="h-3.5 w-3.5" />}
            label={t('settings.project.defaultFormat')}
            help={t('settings.project.defaultFormatHint')}
          >
            <Dropdown<ProjectSettings['downloads']['defaultFormat']>
              fullWidth
              value={draft.downloads.defaultFormat}
              options={[
                { value: 'markdown', label: t('downloadFormat.markdown') },
                { value: 'pdf', label: t('downloadFormat.pdf') },
              ]}
              onChange={(v) => updateNested('downloads', { defaultFormat: v })}
            />
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
  help,
  children,
}: {
  label: string;
  icon?: ReactNode;
  help?: ReactNode;
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
        {help && <InfoTip content={help} />}
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

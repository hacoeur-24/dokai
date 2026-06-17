import { useState, type ReactNode } from 'react';
import {
  UserCog,
  SunMoon,
  Layout as LayoutIcon,
  PanelLeftClose,
  FolderTree,
  FolderClosed,
  Activity,
  Hash,
  Languages,
  Type,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { UserSettings } from 'dokai-core';
import { saveUserSettings } from '../lib/api.js';
import { useRefresh } from '../state.js';
import { useToast } from './Toast.js';
import { useT } from '../i18n/index.js';

export function UserSettingsForm({ initial }: { initial: UserSettings }) {
  const refresh = useRefresh();
  const toast = useToast();
  const t = useT();
  const [draft, setDraft] = useState<UserSettings>(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const updateNested = <K extends keyof UserSettings>(
    key: K,
    patch: Partial<UserSettings[K]>,
  ): void => {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as object), ...patch } }));
    setStatus('idle');
  };

  const handleSave = async (): Promise<void> => {
    setStatus('saving');
    setError(null);
    try {
      await saveUserSettings(draft);
      setStatus('saved');
      refresh();
      toast.show({ message: t('settings.user.saved'), kind: 'success' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      setStatus('idle');
      toast.show({
        message: t('settings.user.saveFailed', { error: errMsg }),
        kind: 'error',
      });
    }
  };

  return (
    <section
      className="flex h-full flex-col rounded-card border bg-(--color-surface)"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-control"
            style={{
              background: 'color-mix(in oklch, var(--color-accent) 10%, transparent)',
              color: 'var(--color-accent)',
            }}
          >
            <UserCog className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{t('settings.user.title')}</h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              {t('settings.user.subtitle', { file: '' })}
              <code className="font-mono">DOKAI/user-settings.local.json</code>
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-7 px-5 py-6">
        <Group icon={<SunMoon className="h-3.5 w-3.5" />} title={t('settings.user.theme')}>
          <Field icon={<SunMoon className="h-3.5 w-3.5" />} label={t('settings.user.themeMode')}>
            <select
              value={draft.theme.mode ?? ''}
              onChange={(e) =>
                updateNested('theme', {
                  mode: (e.target.value || undefined) as UserSettings['theme']['mode'],
                })
              }
              className="dokai-control"
            >
              <option value="">{t('settings.user.themeFollow')}</option>
              <option value="light">{t('themeMode.light')}</option>
              <option value="dark">{t('themeMode.dark')}</option>
              <option value="system">{t('themeMode.system')}</option>
            </select>
          </Field>
        </Group>

        <Group icon={<LayoutIcon className="h-3.5 w-3.5" />} title={t('settings.user.layout')}>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field icon={<Type className="h-3.5 w-3.5" />} label={t('settings.user.fontSize')}>
              <select
                value={draft.ui.fontSize}
                onChange={(e) =>
                  updateNested('ui', {
                    fontSize: e.target.value as UserSettings['ui']['fontSize'],
                  })
                }
                className="dokai-control"
              >
                <option value="default">{t('settings.user.fontSizeDefault')}</option>
                <option value="compact">{t('settings.user.fontSizeCompact')}</option>
                <option value="large">{t('settings.user.fontSizeLarge')}</option>
              </select>
            </Field>
            {/* Replaces the old "Editor mode" dropdown — that setting is now controlled by the
                inline switcher at the top-right of the editor pane (added in v0.2.4). The
                Language selector takes its slot. */}
            <Field icon={<Languages className="h-3.5 w-3.5" />} label={t('settings.user.language')}>
              <select
                value={draft.ui.language}
                onChange={(e) =>
                  updateNested('ui', {
                    language: e.target.value as UserSettings['ui']['language'],
                  })
                }
                className="dokai-control"
              >
                <option value="en">{t('language.en')} | English</option>
                <option value="fr">{t('language.fr')} | Français</option>
              </select>
            </Field>
          </div>
        </Group>

        <Group icon={<FolderTree className="h-3.5 w-3.5" />} title={t('settings.user.sidebarNav')}>
          <div className="grid grid-cols-2 items-end gap-3">
            <Toggle
              icon={<PanelLeftClose className="h-3.5 w-3.5" />}
              label={t('settings.user.autoCollapse')}
              value={draft.ui.sidebarAutoCollapse}
              onChange={(v) => updateNested('ui', { sidebarAutoCollapse: v })}
              tEnabled={t('common.enabled')}
              tDisabled={t('common.disabled')}
            />
            <Toggle
              icon={<FolderClosed className="h-3.5 w-3.5" />}
              label={t('settings.user.foldersCollapsed')}
              value={draft.ui.sidebarFoldersCollapsed}
              onChange={(v) => updateNested('ui', { sidebarFoldersCollapsed: v })}
              tEnabled={t('common.enabled')}
              tDisabled={t('common.disabled')}
            />
            <Toggle
              icon={<Activity className="h-3.5 w-3.5" />}
              label={t('settings.user.showStatus')}
              value={draft.ui.sidebarShowStatus}
              onChange={(v) => updateNested('ui', { sidebarShowStatus: v })}
              tEnabled={t('common.enabled')}
              tDisabled={t('common.disabled')}
            />
            <Toggle
              icon={<Hash className="h-3.5 w-3.5" />}
              label={t('settings.user.showVersions')}
              value={draft.ui.sidebarShowVersions}
              onChange={(v) => updateNested('ui', { sidebarShowVersions: v })}
              tEnabled={t('common.enabled')}
              tDisabled={t('common.disabled')}
            />
          </div>
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
            className="rounded-control px-4 py-1.5 text-sm font-medium transition disabled:opacity-50"
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

function Toggle({
  label,
  icon,
  value,
  onChange,
  tEnabled,
  tDisabled,
}: {
  label: string;
  icon?: ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
  tEnabled: string;
  tDisabled: string;
}) {
  return (
    <label className="block cursor-pointer">
      <span
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        {icon}
        {label}
      </span>
      <span className="dokai-toggle">
        <input
          type="checkbox"
          className="dokai-checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className="flex-1 text-sm"
          style={{
            color: value ? 'var(--color-fg)' : 'var(--color-fg-subtle)',
          }}
        >
          {value ? tEnabled : tDisabled}
        </span>
      </span>
    </label>
  );
}

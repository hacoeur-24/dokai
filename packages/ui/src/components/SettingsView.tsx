import { Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { useSettings } from '../state.js';
import { ProjectSettingsForm } from './ProjectSettingsForm.js';
import { UserSettingsForm } from './UserSettingsForm.js';
import { useT } from '../i18n/index.js';

export function SettingsView() {
  const { data, isLoading } = useSettings();
  const t = useT();

  if (isLoading || !data) {
    return <div className="h-40 w-full animate-pulse rounded bg-bg-muted" />;
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-card border"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-accent)',
          }}
        >
          <SettingsIcon className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <p className="dokai-eyebrow">{t('settings.title')}</p>
          <p className="mt-1 text-[1.02rem]" style={{ color: 'var(--color-fg-muted)' }}>
            {t('settings.subtitle')}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
        <ProjectSettingsForm key={JSON.stringify(data.project)} initial={data.project} />
        <UserSettingsForm key={JSON.stringify(data.user)} initial={data.user} />
      </div>

      {data.errors.length > 0 && (
        <div
          className="rounded-card border p-4"
          style={{ borderColor: 'var(--color-danger)' }}
          role="alert"
        >
          <h3
            className="flex items-center gap-2 font-semibold"
            style={{ color: 'var(--color-danger)' }}
          >
            <AlertTriangle className="h-4 w-4" />
            {t('settings.validationIssues')}
          </h3>
          <ul className="mt-2 list-disc pl-5 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
            {data.errors.map((err, i) => (
              <li key={i}>
                <span className="font-mono">{err.file}</span> — {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

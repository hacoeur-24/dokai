import { Github, PanelLeftClose, PanelLeftOpen, Search, SquareMousePointer } from 'lucide-react';
import { Command as CommandIcon } from 'lucide-react';
import { useSettings } from '../state.js';
import { useT } from '../i18n/index.js';
import { ProjectLogo } from './ProjectLogo.js';

export interface AppHeaderProps {
  projectName: string;
  logo?: string;
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export function AppHeader({
  projectName,
  logo,
  onOpenSearch,
  onToggleSidebar,
  sidebarCollapsed,
}: AppHeaderProps) {
  const settings = useSettings();
  const t = useT();

  const githubUrl = settings.data?.project.githubUrl;
  const appUrl = settings.data?.project.appUrl;

  return (
    <header
      className="flex shrink-0 items-center gap-2 px-3 border-b"
      style={{
        height: 'var(--dokai-header-height)',
        background: 'var(--color-bg-subtle)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Left: sidebar toggle + logo + project name */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? t('sidebar.expandShortcut') : t('sidebar.collapseShortcut')}
          aria-label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          className="dokai-icon-button shrink-0"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        <ProjectLogo src={logo} alt={`${projectName} logo`} />
        <span
          className="min-w-0 truncate text-[0.9rem] font-semibold tracking-tight"
          title={projectName}
          style={{ color: 'var(--color-fg)' }}
        >
          {projectName}
        </span>
      </div>

      {/* Right cluster: GitHub link, Application link, search trigger */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dokai-header-link"
            aria-label={t('header.github')}
          >
            <Github className="h-4 w-4" />
            <span>{t('header.github')}</span>
          </a>
        )}
        {appUrl && (
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dokai-header-link"
            aria-label={t('header.application')}
          >
            <SquareMousePointer className="h-4 w-4" />
            <span>{t('header.application')}</span>
          </a>
        )}
        <button
          type="button"
          onClick={onOpenSearch}
          title={t('layout.searchShortcut')}
          aria-label={t('layout.search')}
          className="ml-2 flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-1.5 text-sm shadow-sm transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] sm:min-w-[200px]"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-fg-subtle)',
            borderColor: 'var(--color-border)',
          }}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden flex-1 text-left sm:block">{t('layout.search')}</span>
          <kbd
            className="flex shrink-0 items-center gap-0.5 rounded-md border bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-[0.7rem]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <CommandIcon className="h-3 w-3" />K
          </kbd>
        </button>
      </div>
    </header>
  );
}

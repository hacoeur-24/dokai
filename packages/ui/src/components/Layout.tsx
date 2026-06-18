import { Outlet, NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Settings as SettingsIcon,
  BookOpen,
  Plus,
} from 'lucide-react';
import { Sidebar } from './Sidebar.js';
import { SearchPalette } from './SearchPalette.js';
import { CreateDocDialog } from './CreateDocDialog.js';
import { AppHeader } from './AppHeader.js';
import { useManifest, useRefresh, useSettings } from '../state.js';
import { useThemeApply } from '../lib/theme.js';
import { saveUserSettings } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { useAutoHideScroll } from '../lib/useAutoHideScroll.js';
import { useT } from '../i18n/index.js';

export function Layout() {
  const manifest = useManifest();
  const settings = useSettings();
  const refresh = useRefresh();
  const t = useT();
  const sidebarScrollRef = useAutoHideScroll<HTMLDivElement>();
  useThemeApply(settings.data?.project ?? null, settings.data?.user ?? null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialFolder, setCreateInitialFolder] = useState<string | undefined>(undefined);

  const openCreateInFolder = (folder: string): void => {
    setCreateInitialFolder(folder);
    setCreateOpen(true);
  };
  const openCreate = (): void => {
    setCreateInitialFolder(undefined);
    setCreateOpen(true);
  };

  // Local sidebar collapsed state, seeded from user-settings and persisted on toggle so the
  // preference survives reloads. Local-first: we update the UI immediately, then write.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (settings.data) setCollapsed(settings.data.user.ui.sidebarCollapsed);
  }, [settings.data]);

  const autoCollapse = settings.data?.user.ui.sidebarAutoCollapse ?? false;

  const setCollapsedAndPersist = (next: boolean): void => {
    if (!settings.data) return;
    setCollapsed(next);
    void saveUserSettings({
      ...settings.data.user,
      ui: { ...settings.data.user.ui, sidebarCollapsed: next },
    })
      .then(() => refresh())
      .catch((err: unknown) => console.error('Failed to persist sidebar state:', err));
  };

  const toggleCollapsed = (): void => setCollapsedAndPersist(!collapsed);

  const handleMainClick = (): void => {
    if (autoCollapse && !collapsed) setCollapsedAndPersist(true);
  };

  // Use a ref so the keyboard handler doesn't need to re-bind every time settings load.
  const toggleRef = useRef(toggleCollapsed);
  toggleRef.current = toggleCollapsed;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      // Cmd/Ctrl-B → toggle sidebar (matches VS Code)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const projectName = settings.data?.project.projectName ?? 'Documentation';

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Full-width top header — logo, project name, external links, search trigger. */}
      <AppHeader
        projectName={projectName}
        logo={settings.data?.project.logo}
        onOpenSearch={() => setSearchOpen(true)}
        onToggleSidebar={toggleRef.current}
        sidebarCollapsed={collapsed}
      />

      {/* Sidebar + main content row fills the remaining vertical space. */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            'relative flex shrink-0 flex-col border-r transition-[width] duration-200 ease-out',
            collapsed ? 'w-0 border-r-0' : 'w-72',
          )}
          style={{ background: 'var(--color-bg-subtle)' }}
          aria-hidden={collapsed}
        >
          {/* Inner panel hidden when collapsed so its content isn't focusable while off-screen. */}
          <div
            className={cn(
              'flex h-full w-72 flex-col transition-opacity duration-150',
              collapsed ? 'pointer-events-none opacity-0' : 'opacity-100',
            )}
          >
            <div className="mx-4 mt-4 mb-4 flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openCreate}
                title={t('layout.newDoc')}
                aria-label={t('layout.newDoc')}
                className="rounded-[var(--radius-control)] border bg-[var(--color-surface)] p-2 text-sm shadow-sm transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div ref={sidebarScrollRef} className="dokai-scroll-auto min-h-0 flex-1 overflow-y-auto">
              <Sidebar
                tree={manifest.data?.tree ?? null}
                loading={manifest.isLoading}
                onAddInFolder={openCreateInFolder}
              />
            </div>

            <nav className="shrink-0 border-t px-3 py-3">
              <NavLink
                to="/dokai/_settings"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-1.5 text-sm transition',
                    isActive
                      ? 'bg-[var(--color-bg-muted)] text-[var(--color-fg)]'
                      : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)]',
                  )
                }
              >
                <SettingsIcon className="h-3.5 w-3.5" />
                {t('layout.settings')}
              </NavLink>
            </nav>
          </div>
        </aside>

        <main className="dokai-scroll relative flex-1 overflow-y-auto" onMouseDown={handleMainClick}>
          <div className="w-full px-10 py-10 lg:px-14">
            <Outlet />
          </div>
        </main>
      </div>

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateDocDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialFolder={createInitialFolder}
      />
    </div>
  );
}

/**
 * Renders the project logo configured in `settings.json#logo`. Path can be:
 *   - Absolute URL (`https://...`) → used directly
 *   - Relative path (`./assets/logo.svg`) → served via `/dokai-asset?path=...` from DOKAI/
 * Falls back to the BookOpen icon when the path is empty or the image fails to load.
 */
export function ProjectLogo({ src, alt }: { src?: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const trimmed = src?.trim();
  // Conventions:
  //   "https://..."    → use the URL directly
  //   "./foo" or "foo" → relative to DOKAI/
  //   "/foo"           → relative to the repo root (e.g. "/public/logo.svg")
  //   "../foo"         → relative to DOKAI/, escaping into the repo
  const url = trimmed
    ? /^https?:\/\//.test(trimmed)
      ? trimmed
      : `/dokai-asset?path=${encodeURIComponent(trimmed)}`
    : null;

  // Reset the broken flag whenever the source changes — without this, a previously failed
  // URL (e.g. an HTML page mistakenly used as an image) leaves `broken` stuck at true and
  // the next valid path silently falls back to BookOpen instead of attempting to load.
  useEffect(() => {
    setBroken(false);
  }, [url]);

  if (!url || broken) {
    return <BookOpen className="h-5 w-5 shrink-0" style={{ color: 'var(--color-accent)' }} />;
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-5 w-5 shrink-0 object-contain"
      onError={() => setBroken(true)}
    />
  );
}

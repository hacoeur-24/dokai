import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight, FileText, Folder, FolderOpen, Globe, Lock, Plus, Webhook } from 'lucide-react';
import type { SectionNode } from 'dokai-core';
import { useManifest, useSettings } from '../state.js';
import { cn } from '../lib/cn.js';
import { DocContextMenu } from './DocContextMenu.js';
import { useT } from '../i18n/index.js';

const OVERRIDES_KEY = 'dokai:sidebar:folderOverrides';

export interface SidebarHandle {
  collapseAll: (collapsed: boolean) => void;
}

export interface SidebarProps {
  tree: SectionNode | null;
  loading: boolean;
  onAddInFolder?: (folder: string) => void;
}

/**
 * Per-folder collapse overrides. `sidebarFoldersCollapsed` is the *default* and is the source
 * of truth on every page load: when it's `true`, we ignore any persisted overrides so a refresh
 * always starts with all folders collapsed. When it's `false`, we restore the user's per-folder
 * toggles from localStorage so a refresh keeps their custom state. Toggles made during a session
 * are persisted, but they only survive a reload while the default is `false`.
 */
function useFolderOverrides(defaultCollapsed: boolean | null): {
  overrides: ReadonlyMap<string, boolean>;
  toggle: (path: string, currentlyCollapsed: boolean) => void;
  setAll: (collapsed: boolean, allPaths: string[]) => void;
} {
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  const toggle = useCallback((path: string, currentlyCollapsed: boolean) => {
    setOverrides((prev) => new Map(prev).set(path, !currentlyCollapsed));
  }, []);

  const setAll = useCallback((collapsed: boolean, allPaths: string[]) => {
    setOverrides(() => new Map(allPaths.map((p) => [p, collapsed])));
  }, []);

  // Sync overrides with the settled default. `null` means settings are still loading — wait.
  useEffect(() => {
    if (defaultCollapsed === null) return;
    if (defaultCollapsed) {
      // Default = collapsed. Refresh always starts pristine — wipe any localStorage overrides
      // so previously-expanded folders don't override the default.
      setOverrides(new Map());
      try {
        window.localStorage.removeItem(OVERRIDES_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    // Default = open. Restore the user's per-folder toggles from localStorage.
    try {
      const raw = window.localStorage.getItem(OVERRIDES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const entries = parsed.filter(
        (e): e is [string, boolean] =>
          Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'boolean',
      );
      setOverrides(new Map(entries));
    } catch {
      /* ignore */
    }
  }, [defaultCollapsed]);

  // Persist overrides on change — but only while the default is `open`. With `default=collapsed`
  // we treat the session as ephemeral, so we don't write the user's transient toggles to disk.
  useEffect(() => {
    if (defaultCollapsed !== false) return;
    try {
      window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify([...overrides.entries()]));
    } catch {
      /* ignore */
    }
  }, [overrides, defaultCollapsed]);

  return { overrides, toggle, setAll };
}

function collectFolderPaths(section: SectionNode): string[] {
  const out: string[] = [];
  for (const child of section.sections) {
    out.push(child.relativePath);
    out.push(...collectFolderPaths(child));
  }
  return out;
}

export const Sidebar = forwardRef<SidebarHandle, SidebarProps>(function Sidebar(
  { tree, loading, onAddInFolder },
  ref,
) {
  const settings = useSettings();
  const t = useT();
  const showStatus = settings.data?.user.ui.sidebarShowStatus ?? true;
  const showVersions = settings.data?.user.ui.sidebarShowVersions ?? false;
  // `null` while settings load → useFolderOverrides treats it as "not yet settled" and
  // skips the override-clear logic, so we don't wipe localStorage on every page load.
  const defaultCollapsed = settings.data ? settings.data.user.ui.sidebarFoldersCollapsed : null;
  const { overrides, toggle, setAll } = useFolderOverrides(defaultCollapsed);
  const effectiveDefault = defaultCollapsed ?? false;

  useImperativeHandle(
    ref,
    () => ({
      collapseAll: (collapsed: boolean) => {
        if (tree) setAll(collapsed, collectFolderPaths(tree));
      },
    }),
    [tree, setAll],
  );

  if (loading) return <SidebarSkeleton />;
  if (!tree) {
    return (
      <p className="px-5 text-sm" style={{ color: 'var(--color-fg-subtle)' }}>
        {t('sidebar.noDocs')}
      </p>
    );
  }

  const isCollapsed = (path: string): boolean => {
    const override = overrides.get(path);
    return override !== undefined ? override : effectiveDefault;
  };

  return (
    <nav className="px-3 pb-4">
      <SectionEntry
        section={tree}
        depth={0}
        onAddInFolder={onAddInFolder}
        showStatus={showStatus}
        showVersions={showVersions}
        isCollapsed={isCollapsed}
        onToggle={toggle}
        t={t}
      />
      <ApiNavGroup />
    </nav>
  );
});

function ApiNavGroup() {
  const manifest = useManifest();
  const specs = manifest.data?.specs ?? [];
  if (specs.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="dokai-sidebar-folder mt-3 mb-1 flex items-center gap-1.5 pr-1">
        <Webhook className="dokai-sidebar-folder-icon" />
        <span className="min-w-0 flex-1 truncate text-left">APIs</span>
      </div>
      <div className="ml-2.75 border-l pl-2" style={{ borderColor: 'var(--color-border)' }}>
        <ul className="flex flex-col gap-px">
          {specs.map((spec) => (
            <li key={spec.route}>
              <NavLink to={spec.route} end className="dokai-sidebar-row">
                {spec.hasSecurity ? (
                  <Lock className="dokai-sidebar-row-icon" />
                ) : (
                  <Globe className="dokai-sidebar-row-icon" />
                )}
                <span className="dokai-sidebar-row-title">{spec.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface SectionEntryProps {
  section: SectionNode;
  depth: number;
  onAddInFolder?: (folder: string) => void;
  showStatus: boolean;
  showVersions: boolean;
  isCollapsed: (path: string) => boolean;
  onToggle: (path: string, currentlyCollapsed: boolean) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function SectionEntry(props: SectionEntryProps) {
  const { section, depth, onAddInFolder, showStatus, showVersions, isCollapsed, onToggle, t } =
    props;
  const isRoot = depth === 0;
  const title =
    section.metadata?.title ?? toTitle(section.relativePath || t('sidebar.documentation'));
  const collapsed = isRoot ? false : isCollapsed(section.relativePath);
  const hasChildren = section.docs.length > 0 || section.sections.length > 0;

  return (
    <div className={cn(isRoot ? '' : 'mt-3')}>
      {!isRoot && (
        <div className="dokai-sidebar-folder group mt-3 mb-1 flex items-center justify-between gap-1.5 pr-1">
          <button
            type="button"
            onClick={() => onToggle(section.relativePath, collapsed)}
            className="dokai-sidebar-folder-toggle"
            aria-expanded={!collapsed}
            title={
              collapsed
                ? t('sidebar.expandFolder', { folder: title })
                : t('sidebar.collapseFolder', { folder: title })
            }
          >
            <ChevronRight
              className={cn('dokai-sidebar-folder-chevron', collapsed ? '' : 'rotate-90')}
            />
            {collapsed ? (
              <Folder className="dokai-sidebar-folder-icon" />
            ) : (
              <FolderOpen className="dokai-sidebar-folder-icon" />
            )}
            <span className="min-w-0 flex-1 truncate text-left">{title}</span>
          </button>
          {onAddInFolder && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onAddInFolder(section.relativePath);
              }}
              title={t('sidebar.addInFolder', { folder: section.relativePath })}
              aria-label={t('sidebar.addInFolder', {
                folder: section.relativePath,
              })}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-control opacity-0 transition group-hover:opacity-100 hover:bg-bg-muted hover:text-fg"
              style={{ color: 'var(--color-fg-muted)' }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {hasChildren && !collapsed && (
        <div
          className={cn(!isRoot && 'ml-2.75 border-l pl-2')}
          style={!isRoot ? { borderColor: 'var(--color-border)' } : undefined}
        >
          <ul className="flex flex-col gap-px">
            {section.docs.map((doc) => (
              <li key={doc.route}>
                <DocContextMenu route={doc.route} relativePath={doc.relativePath}>
                  {/* Static className (not the function form) — Radix's <Slot> in
                      DocContextMenu does `[slot, child].join(' ')` to merge classNames;
                      a function would be stringified to its source and the row would
                      lose all styling. We rely on NavLink's auto-set aria-current="page"
                      attribute for active styling instead. */}
                  <NavLink to={doc.route} end className="dokai-sidebar-row">
                    <FileText className="dokai-sidebar-row-icon" />
                    <span className="dokai-sidebar-row-title">{doc.frontmatter.title}</span>
                    <span className="dokai-sidebar-row-meta">
                      {showStatus && doc.frontmatter.status && (
                        <SidebarStatusBadge status={doc.frontmatter.status} />
                      )}
                      {showVersions && <SidebarVersionBadge version={doc.frontmatter.version} />}
                    </span>
                  </NavLink>
                </DocContextMenu>
              </li>
            ))}
          </ul>

          {section.sections.map((child) => (
            <SectionEntry
              key={child.relativePath}
              section={child}
              depth={depth + 1}
              onAddInFolder={onAddInFolder}
              showStatus={showStatus}
              showVersions={showVersions}
              t={t}
              isCollapsed={isCollapsed}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarStatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-1.5 text-[0.62rem] font-medium leading-[1.4]"
      style={{
        background: `var(--tone-${status}-bg, var(--color-bg-muted))`,
        color: `var(--tone-${status}-fg, var(--color-fg-muted))`,
      }}
      title={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

function SidebarVersionBadge({ version }: { version: string }) {
  return (
    <span
      className="shrink-0 font-mono text-[0.62rem] leading-[1.4]"
      style={{ color: 'var(--color-fg-subtle)' }}
      title={`Version: ${version}`}
    >
      v{version}
    </span>
  );
}

function SidebarSkeleton() {
  return (
    <div className="px-5 py-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="my-1.5 h-3 w-full animate-pulse rounded"
          style={{ background: 'var(--color-bg-muted)', opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}

function toTitle(path: string): string {
  const last = path.split('/').pop() ?? '';
  return last
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

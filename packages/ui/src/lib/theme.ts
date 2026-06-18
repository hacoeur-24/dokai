import { useEffect, useState } from 'react';
import type { ProjectSettings, UserSettings } from 'dokai-core';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Resolve which theme mode is in effect, applying the documented hierarchy:
 *   user-settings.theme.mode > project-settings.theme.defaultMode > 'system'
 */
export function resolveThemeMode(project: ProjectSettings, user: UserSettings): ThemeMode {
  return user.theme.mode ?? project.theme.defaultMode ?? 'system';
}

/** Convert a theme mode to the `data-theme` attribute value, resolving 'system' via prefers-color-scheme. */
function effectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply the resolved theme to <html data-theme="..."> and bind any inline CSS variables. */
export function applyTheme(project: ProjectSettings, user: UserSettings): void {
  const mode = resolveThemeMode(project, user);
  const concrete = effectiveTheme(mode);
  const root = document.documentElement;
  root.dataset['theme'] = concrete;
  root.style.setProperty('--dokai-primary', project.theme.primaryColor);
  root.style.setProperty('--dokai-radius', radiusToCss(project.theme.radius));
  root.style.setProperty('--dokai-font-scale', String(fontScale(user.ui.fontSize)));
}

function radiusToCss(radius: ProjectSettings['theme']['radius']): string {
  // Aggressive scale so the four options feel visually distinct.
  switch (radius) {
    case 'none':
      return '0';
    case 'small':
      return '0.25rem';
    case 'medium':
      return '0.625rem';
    case 'large':
      return '1.125rem';
  }
}

/**
 * "Zoom" factor applied to the root font size. Because Tailwind tokens are mostly in `rem`,
 * scaling the root font size cascades to spacing, controls, and prose at once — more
 * information visible on `compact`, less on `large`.
 *
 * The default is `0.94` so even the "default" density is slightly tighter than a browser
 * default (16 px → 15 px), per the user's request.
 */
function fontScale(size: UserSettings['ui']['fontSize']): number {
  switch (size) {
    case 'compact':
      return 0.85;
    case 'default':
      return 0.94;
    case 'large':
      return 1.06;
  }
}

function readResolvedTheme(): 'light' | 'dark' {
  return typeof document !== 'undefined' && document.documentElement.dataset['theme'] === 'dark'
    ? 'dark'
    : 'light';
}

/**
 * Reactive hook returning the current resolved theme ('light' | 'dark') by observing the
 * `data-theme` attribute on <html> — the single source of truth that `applyTheme` /
 * `useThemeApply` keep in sync for both settings changes and 'system' (OS) preference flips.
 */
export function useResolvedTheme(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(readResolvedTheme);
  useEffect(() => {
    setMode(readResolvedTheme());
    const observer = new MutationObserver(() => setMode(readResolvedTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return mode;
}

/** Reactive hook that re-applies theme when system preference flips while in 'system' mode. */
export function useThemeApply(project: ProjectSettings | null, user: UserSettings | null): void {
  const [, force] = useState(0);
  useEffect(() => {
    if (!project || !user) return;
    applyTheme(project, user);
    if (resolveThemeMode(project, user) !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyTheme(project, user);
      force((n) => n + 1);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [project, user]);
}

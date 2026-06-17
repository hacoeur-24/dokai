import { useCallback } from 'react';
import en from './locales/en.json';
import fr from './locales/fr.json';
import { useSettings } from '../state.js';

const dictionaries = { en, fr } as const;
export type Locale = keyof typeof dictionaries;
export const SUPPORTED_LOCALES: Locale[] = ['en', 'fr'];

type Dict = Record<string, string>;

/**
 * Look up a translation key for a locale, optionally interpolating `{var}` placeholders.
 *
 * Resolution order:
 *   1. Selected locale's value
 *   2. English fallback
 *   3. The key itself (so missing translations are visible in dev, never crash the UI)
 */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = (dictionaries[locale] ?? dictionaries.en) as Dict;
  let value = dict[key] ?? (dictionaries.en as Dict)[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
    }
  }
  return value;
}

/**
 * React hook returning a memoized `t()` bound to the current user's selected locale.
 *
 * Reads `user.ui.language` from settings; defaults to `en` while settings are still loading or
 * if the saved value isn't a recognised locale.
 */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const settings = useSettings();
  const raw = settings.data?.user.ui.language;
  const locale: Locale = raw === 'fr' ? 'fr' : 'en';
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => t(locale, key, vars),
    [locale],
  );
}

/** Hook returning just the active locale — useful for non-string-formatting needs. */
export function useLocale(): Locale {
  const settings = useSettings();
  return settings.data?.user.ui.language === 'fr' ? 'fr' : 'en';
}

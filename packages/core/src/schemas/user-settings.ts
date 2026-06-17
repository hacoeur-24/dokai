import { z } from 'zod';

export const userSettingsSchema = z
  .object({
    theme: z
      .object({
        mode: z.enum(['light', 'dark', 'system']).optional(),
      })
      .default({}),
    ui: z
      .object({
        /** Live sidebar state — open/closed, persisted across reloads. Set by the toggle
         *  buttons / the ⌘B shortcut. Not directly user-editable in the settings UI. */
        sidebarCollapsed: z.boolean().default(false),
        /** When true, clicking outside the sidebar (anywhere in the main content area)
         *  collapses it automatically. Surface in the settings UI as "Sidebar auto-collapse". */
        sidebarAutoCollapse: z.boolean().default(false),
        /** When true, sidebar folders start collapsed by default. The user can still toggle
         *  individual folders open; their per-folder choices override this default and live
         *  in localStorage. */
        sidebarFoldersCollapsed: z.boolean().default(false),
        /** Show a small status badge (draft/review/stable/...) next to each doc in the sidebar. */
        sidebarShowStatus: z.boolean().default(true),
        /** Show the doc's version next to its title in the sidebar. Off by default so the tree
         *  feels uncluttered; users can opt in via User Settings → Sidebar navigation. */
        sidebarShowVersions: z.boolean().default(false),
        /** UI density — drives a `--dokai-font-scale` CSS variable that scales the whole app
         *  via root font-size, like a per-user zoom level. */
        fontSize: z.enum(['compact', 'default', 'large']).default('default'),
        editorMode: z.enum(['rich-text', 'source']).default('rich-text'),
        /** UI language. `en` (English) or `fr` (French). Drives the i18n `t()` function across
         *  the app. Default `en`. */
        language: z.enum(['en', 'fr']).default('en'),
        lastOpenedDoc: z.string().optional(),
      })
      .default({}),
    search: z
      .object({
        recentQueries: z.array(z.string()).max(20).default([]),
      })
      .default({}),
  })
  .default({});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export function defaultUserSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return userSettingsSchema.parse(overrides);
}

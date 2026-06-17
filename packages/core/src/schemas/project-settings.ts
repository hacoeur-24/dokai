import { z } from 'zod';

const themeSchema = z
  .object({
    defaultMode: z.enum(['light', 'dark', 'system']).default('system'),
    primaryColor: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'primaryColor must be a hex color')
      .default('#2563eb'),
    radius: z.enum(['none', 'small', 'medium', 'large']).default('medium'),
  })
  .default({});

const downloadsSchema = z
  .object({
    /** Default format for the right-click "Download" action and the in-doc Download button's
     *  primary action. Users can still pick the other format from the in-doc dropdown. */
    defaultFormat: z.enum(['markdown', 'pdf']).default('markdown'),
  })
  .default({});

const repositorySchema = z
  .object({
    type: z.enum(['auto', 'normal', 'workspaces', 'turborepo', 'monorepo']).default('auto'),
    structure: z.enum(['auto', 'flat', 'workspace-mapped']).default('auto'),
    monorepo: z.boolean().default(false),
    turborepo: z.boolean().default(false),
  })
  .default({});

export const projectSettingsSchema = z
  .object({
    projectName: z.string().min(1).default('Project Documentation'),
    logo: z.string().optional(),
    theme: themeSchema,
    downloads: downloadsSchema,
    repository: repositorySchema,
  })
  .default({});

export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export function defaultProjectSettings(overrides: Partial<ProjectSettings> = {}): ProjectSettings {
  return projectSettingsSchema.parse(overrides);
}

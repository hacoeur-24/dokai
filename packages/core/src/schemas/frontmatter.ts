import { z } from 'zod';

export const docStatusSchema = z.enum(['draft', 'review', 'stable', 'deprecated', 'archived']);

export const frontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  tags: z.array(z.string()).default([]),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/, 'version must be a valid semver string')
    .default('0.1.0'),
  status: docStatusSchema.optional(),
  owner: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});

export type DocStatus = z.infer<typeof docStatusSchema>;
export type Frontmatter = z.infer<typeof frontmatterSchema>;

export const partialFrontmatterSchema = frontmatterSchema.partial();
export type PartialFrontmatter = z.infer<typeof partialFrontmatterSchema>;

/**
 * Default frontmatter for newly created docs. The CLI seeds this; the editor uses it as the
 * baseline when a user creates a doc with no overrides.
 */
export function defaultFrontmatter(input: { title: string; description?: string }): Frontmatter {
  const now = new Date().toISOString();
  return {
    title: input.title,
    description: input.description?.trim() || `Documentation for ${input.title}.`,
    tags: [],
    version: '0.1.0',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

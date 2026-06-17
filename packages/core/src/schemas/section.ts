import { z } from 'zod';

export const sectionMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/)
    .optional(),
  order: z.number().int().optional(),
  icon: z.string().optional(),
  hidden: z.boolean().default(false),
});

export type SectionMetadata = z.infer<typeof sectionMetadataSchema>;

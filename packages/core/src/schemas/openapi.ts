import { z } from 'zod';

export const openapiSettingsSchema = z
  .object({
    /** Master toggle for the OpenAPI explorer feature. */
    enabled: z.boolean().default(true),
    /** Path under DOKAI/ that holds OpenAPI spec files. */
    dir: z.string().min(1).default('openapi'),
    /** Extra hosts the try-it-out proxy may forward to, beyond loopback and spec servers. */
    allowedHosts: z.array(z.string()).default([]),
    /** Whether Scalar persists the entered auth (bearer token) in the browser. */
    persistAuth: z.boolean().default(true),
  })
  .default({});

export type OpenApiSettings = z.infer<typeof openapiSettingsSchema>;

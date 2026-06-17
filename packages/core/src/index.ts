/**
 * Browser-safe entry for `dokai-core`. Exposes schemas, route helpers, slug helpers,
 * and shared types. Importing this entry must not pull in any Node-only dependency
 * (no `fs`, no `gray-matter`, no `fast-glob`).
 */

export * from './schemas/frontmatter.js';
export * from './schemas/section.js';
export * from './schemas/project-settings.js';
export * from './schemas/user-settings.js';
export * from './route.js';
export * from './slug.js';
export * from './types.js';

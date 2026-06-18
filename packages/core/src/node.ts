/**
 * Node-only entry for `dokai-core`. Re-exports filesystem-touching utilities used by
 * the CLI and the Vite plugin. The browser bundle MUST NOT import from this entry.
 */

export * from './settings.js';
export * from './scan.js';
export * from './parse.js';
export * from './search.js';
export * from './version.js';
export * from './detect/repo.js';
export * from './detect/package-manager.js';
export * from './detect/workspaces.js';
export * from './detect/turbo.js';

export type { Frontmatter, PartialFrontmatter, DocStatus } from './schemas/frontmatter.js';
export type { SectionMetadata } from './schemas/section.js';
export type { ProjectSettings } from './schemas/project-settings.js';
export type { UserSettings } from './schemas/user-settings.js';
export type {
  DocNode,
  DocHeading,
  SectionNode,
  RepoInfo,
  RepoShape,
  PackageManager,
  WorkspaceEntry,
  TurboInfo,
} from './types.js';

export { pathToRoute, routeToPath, anchorRoute } from './route.js';
export { scanOpenApiSpecs } from './openapi/scan.js';
export type { ScanOpenApiOptions, OpenApiScanResult } from './openapi/scan.js';
export { headingSlug, createSlugger } from './slug.js';
export { defaultFrontmatter, frontmatterSchema } from './schemas/frontmatter.js';
export { defaultProjectSettings, projectSettingsSchema } from './schemas/project-settings.js';
export { defaultUserSettings, userSettingsSchema } from './schemas/user-settings.js';
export { sectionMetadataSchema } from './schemas/section.js';

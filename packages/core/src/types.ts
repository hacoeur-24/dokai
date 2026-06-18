import type { Frontmatter } from './schemas/frontmatter.js';
import type { SectionMetadata } from './schemas/section.js';

/** A heading inside a doc, used for TOC and anchor links. */
export interface DocHeading {
  /** Heading depth (1-6) */
  depth: number;
  /** Plain-text content of the heading */
  text: string;
  /** Slug used in the URL fragment */
  slug: string;
}

/** A scanned markdown document. */
export interface DocNode {
  /** Path relative to the DOKAI/ root, e.g. "backend/api.md". */
  relativePath: string;
  /** Absolute filesystem path. */
  absolutePath: string;
  /** Deterministic web route, e.g. "/dokai/backend/api". */
  route: string;
  /** Workspace package name when the doc lives under a mapped section, else null. */
  workspace: string | null;
  /** Validated frontmatter. */
  frontmatter: Frontmatter;
  /** Headings discovered in the document body. */
  headings: DocHeading[];
  /** Plain-text body for indexing (frontmatter stripped). */
  bodyText: string;
  /** Raw markdown body (frontmatter stripped) for re-rendering on the client. */
  bodyMarkdown: string;
}

/** A folder section, derived from a folder's _section.json or implicitly from its children. */
export interface SectionNode {
  /** Path relative to DOKAI/ (no trailing slash), e.g. "backend". Empty string for root. */
  relativePath: string;
  /** Absolute filesystem path of the folder. */
  absolutePath: string;
  /** Section metadata if a _section.json was present; null otherwise. */
  metadata: SectionMetadata | null;
  /** Child sections. */
  sections: SectionNode[];
  /** Documents directly inside this section. */
  docs: DocNode[];
}

/** Repository shape detected by repo introspection. */
export type RepoShape = 'normal' | 'workspaces' | 'turborepo' | 'monorepo-non-turbo';

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

export interface WorkspaceEntry {
  /** Package name from package.json. */
  name: string;
  /** Path relative to repo root, e.g. "packages/web". */
  path: string;
  /** Coarse classification used for sidebar grouping in monorepos. */
  category: 'app' | 'package' | 'service' | 'tooling' | 'unknown';
}

export interface TurboInfo {
  /** Tasks declared in turbo.json. */
  pipelines: string[];
}

export interface RepoInfo {
  packageManager: PackageManager;
  shape: RepoShape;
  /** Absolute path of the repository root (where the root package.json lives). */
  root: string;
  workspaces: WorkspaceEntry[];
  turbo: TurboInfo | null;
}

export interface OpenApiOperationMeta {
  /** Upper-case HTTP method, e.g. "GET". */
  method: string;
  /** Templated path, e.g. "/payments/{id}". */
  path: string;
  /** Operation summary, or "" if absent. */
  summary: string;
  /** True when the operation requires auth after resolving op-level over global security. */
  secured: boolean;
}

export interface OpenApiSpecMeta {
  /** Posix path relative to DOKAI/, e.g. "openapi/billing/payments.yaml". */
  relativePath: string;
  /** In-app route, e.g. "/dokai/_api/billing/payments". */
  route: string;
  title: string;
  version: string;
  description: string;
  /** True when any operation is secured. Drives the sidebar lock icon. */
  hasSecurity: boolean;
  operationCount: number;
  /** Hostnames parsed from servers[].url (or swagger 2.0 `host`). Feed the proxy allowlist. */
  serverHosts: string[];
  operations: OpenApiOperationMeta[];
  workspace: string | null;
}

export interface OpenApiScanError {
  relativePath: string;
  message: string;
}

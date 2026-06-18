/**
 * API client for the DOKAI dev/build server.
 * - Read endpoints work in both modes.
 * - Write endpoints work only in dev mode and throw on the static build.
 */

import type { DocNode, Frontmatter, OpenApiSpecMeta, ProjectSettings, SectionNode, UserSettings } from 'dokai-core';

export interface Manifest {
  tree: SectionNode;
  docs: Array<Pick<DocNode, 'route' | 'frontmatter' | 'workspace' | 'relativePath'>>;
  specs: OpenApiSpecMeta[];
  capabilities: { tryItOut: boolean };
}

export interface SettingsBundle {
  project: ProjectSettings;
  user: UserSettings;
  errors: Array<{ file: string; message: string }>;
}

export interface SearchIndexPayload {
  schema: 1;
  generatedAt: string;
  documents: Array<{
    id: string;
    title: string;
    description: string;
    tags: string[];
    version: string;
    status?: string;
    package: string | null;
    route: string;
    /** Folder path inside DOKAI/ (e.g. "architecture/v2"); empty string for root-level docs. */
    folderPath: string;
    /** Human-readable folder title for grouping in the search palette; empty for root docs. */
    folderTitle: string;
  }>;
  index: object;
  tags: string[];
  statuses: string[];
}

async function getJson<T>(path: string): Promise<T> {
  // `cache: 'no-store'` so a stale cached GET doesn't override the post-save refresh.
  const res = await fetch(path, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function sendJson<T>(method: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `${path} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const fetchManifest = (): Promise<Manifest> => getJson('/api/manifest');
export const fetchDoc = (route: string): Promise<DocNode> =>
  getJson(`/api/doc?route=${encodeURIComponent(route)}`);
/** URL the browser can hit to download the raw markdown file (Content-Disposition: attachment). */
export const docDownloadUrl = (route: string): string =>
  `/api/doc/raw?route=${encodeURIComponent(route)}`;
export const fetchSettings = (): Promise<SettingsBundle> => getJson('/api/settings');
export const fetchSearchIndex = (): Promise<SearchIndexPayload> => getJson('/api/search-index');

export const saveDoc = (
  route: string,
  body: { frontmatter: Frontmatter; bodyMarkdown: string },
): Promise<{ ok: true }> => sendJson('PUT', `/api/doc?route=${encodeURIComponent(route)}`, body);

export const createDoc = (
  route: string,
  body: { title: string; description?: string; body?: string },
): Promise<{ ok: true; route: string }> =>
  sendJson('POST', `/api/doc?route=${encodeURIComponent(route)}`, body);

export const renameDoc = (
  route: string,
  newRelativePath: string,
): Promise<{ ok: true; route: string }> =>
  sendJson('PATCH', `/api/doc?route=${encodeURIComponent(route)}`, {
    newRelativePath,
  });

export const deleteDoc = async (route: string): Promise<{ ok: true }> => {
  const res = await fetch(`/api/doc?route=${encodeURIComponent(route)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `${res.status} ${res.statusText}`);
  }
  return { ok: true };
};

export const saveProjectSettings = (settings: ProjectSettings): Promise<{ ok: true }> =>
  sendJson('PUT', '/api/settings', settings);

export const saveUserSettings = (settings: UserSettings): Promise<{ ok: true }> =>
  sendJson('PUT', '/api/user-settings', settings);

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { defaultFrontmatter, type RepoInfo, type WorkspaceEntry } from 'dokai-core';

export interface DokaiFolderResult {
  /** Files written (absolute paths). */
  written: string[];
  /** Files that already existed and were left untouched. */
  skipped: string[];
}

/**
 * Create the DOKAI/ folder with a seed `index.md`, an `architecture/overview.md`, `_section.json`
 * files that anchor the section titles + ordering, and one placeholder doc per mapped workspace
 * package. Existing files are never overwritten — init is idempotent.
 *
 * The seeded skeleton is intentionally small. The intent is to give Claude Code's
 * `/set-documentation` command a structural anchor (section titles, frontmatter shape, Mermaid
 * example) without pre-filling content the AI is supposed to author.
 */
export async function scaffoldDokaiFolder(opts: {
  dokaiRoot: string;
  repo: RepoInfo;
  workspaceMappings: Array<{ workspace: WorkspaceEntry; dokaiPath: string }>;
}): Promise<DokaiFolderResult> {
  const written: string[] = [];
  const skipped: string[] = [];

  await mkdir(opts.dokaiRoot, { recursive: true });

  // Root-level section metadata. Anchors the top-level title + order so the sidebar reads
  // "Documentation" instead of an auto-humanized folder name.
  await writeOnce(
    join(opts.dokaiRoot, '_section.json'),
    seedSection({
      title: 'Documentation',
      description: 'Project documentation root.',
      tags: ['documentation'],
      order: 0,
    }),
    written,
    skipped,
  );

  await writeOnce(
    join(opts.dokaiRoot, 'index.md'),
    seedDoc({
      title: 'Documentation',
      description:
        'Welcome to the project documentation. Replace this content with an overview of your project.',
      body: [
        '# Documentation',
        '',
        'This documentation is powered by **DOKAI** — local-first markdown docs with built-in search,',
        'Mermaid diagrams, and a Claude-Code-driven authoring workflow.',
        '',
        '## How to populate this',
        '',
        'Two slash commands are wired up in `.claude/commands/`:',
        '',
        '- **`/set-documentation`** — first-time deep read of the codebase. Generates the full doc tree.',
        '  Use this when DOKAI/ is empty (or just has these seeded stubs).',
        '- **`/update-documentation`** — incremental refresh. Compares the current docs against the',
        '  current codebase, fixes drift, and creates new docs for undocumented areas — all',
        '  following the structure conventions already in DOKAI/.',
        '',
        '## Where to start',
        '',
        '- Architecture: see `architecture/overview.md`',
        '- Run `pnpm dokai` to launch the editor UI on http://localhost:8128',
        '',
      ].join('\n'),
    }),
    written,
    skipped,
  );

  await mkdir(join(opts.dokaiRoot, 'architecture'), { recursive: true });
  await writeOnce(
    join(opts.dokaiRoot, 'architecture', '_section.json'),
    seedSection({
      title: 'Architecture',
      description: 'System-level architecture, data flow, and component relationships.',
      tags: ['architecture'],
      order: 1,
    }),
    written,
    skipped,
  );
  await writeOnce(
    join(opts.dokaiRoot, 'architecture', 'overview.md'),
    seedDoc({
      title: 'Architecture overview',
      description: 'High-level system architecture and how the major pieces fit together.',
      tags: ['architecture'],
      body: [
        '# Architecture overview',
        '',
        'Replace this section with a high-level description of your system.',
        '',
        '```mermaid',
        'flowchart LR',
        '    A[Client] --> B[API]',
        '    B --> C[(Database)]',
        '```',
        '',
      ].join('\n'),
    }),
    written,
    skipped,
  );

  for (const { workspace, dokaiPath } of opts.workspaceMappings) {
    const dir = join(opts.dokaiRoot, dokaiPath);
    await mkdir(dir, { recursive: true });
    await writeOnce(
      join(dir, 'overview.md'),
      seedDoc({
        title: `${workspace.name} overview`,
        description: `Documentation for the ${workspace.name} ${workspace.category}.`,
        tags: [workspace.category, workspace.name],
        body: [
          `# ${workspace.name}`,
          '',
          `Document the purpose, public API, and key flows for the **${workspace.name}** ${workspace.category} here.`,
          '',
        ].join('\n'),
      }),
      written,
      skipped,
    );
  }

  return { written, skipped };
}

interface SeedSectionInput {
  title: string;
  description: string;
  tags?: string[];
  order?: number;
}

function seedSection({ title, description, tags = [], order }: SeedSectionInput): string {
  const json: Record<string, unknown> = {
    title,
    description,
    tags,
    version: '0.1.0',
  };
  if (typeof order === 'number') json['order'] = order;
  return `${JSON.stringify(json, null, 2)}\n`;
}

interface SeedDocInput {
  title: string;
  description: string;
  tags?: string[];
  body: string;
}

function seedDoc({ title, description, tags = [], body }: SeedDocInput): string {
  const fm = defaultFrontmatter({ title, description });
  fm.tags = tags;
  return matter.stringify(`\n${body}`, fm);
}

async function writeOnce(
  path: string,
  contents: string,
  written: string[],
  skipped: string[],
): Promise<void> {
  if (existsSync(path)) {
    skipped.push(path);
    return;
  }
  await writeFile(path, contents, 'utf8');
  written.push(path);
}

/** Suggest workspace → DOKAI-folder mappings from a list of workspace packages. */
export function suggestWorkspaceMappings(
  workspaces: WorkspaceEntry[],
): Array<{ workspace: WorkspaceEntry; dokaiPath: string }> {
  return workspaces.map((w) => ({ workspace: w, dokaiPath: w.path }));
}

/** Read an existing file and return whether the contents already include the marker. */
export async function fileContains(path: string, marker: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  const content = await readFile(path, 'utf8');
  return content.includes(marker);
}

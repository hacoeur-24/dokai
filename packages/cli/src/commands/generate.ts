import { resolve, join } from 'node:path';
import {
  scanDokai,
  buildSearchIndex,
  defaultSearchIndexPath,
  loadSettings,
  scanOpenApiSpecs,
} from 'dokai-core/node';
import { scaffoldAgentAssets } from '../scaffold/agents.js';
import { log } from '../lib/log.js';

export interface GenerateOptions {
  root?: string;
  /** Skip the search index rebuild. */
  noSearch?: boolean;
  /** Skip the Claude command/skill re-emit (`.claude/`). */
  noClaude?: boolean;
  /** Skip the agent-agnostic re-emit (`.agents/` + `AGENTS.md`). */
  noAgents?: boolean;
}

/** Re-emit derived artifacts (Claude + agent assets, search index) without launching dev. */
export async function runGenerate(options: GenerateOptions = {}): Promise<void> {
  const root = resolve(options.root ?? process.cwd());
  const dokaiRoot = join(root, 'DOKAI');

  if (!options.noClaude || !options.noAgents) {
    const result = await scaffoldAgentAssets({
      repoRoot: root,
      claude: !options.noClaude,
      agents: !options.noAgents,
    });
    if (result.written.length > 0) log.success(`Wrote ${result.written.length} agent file(s)`);
    if (result.skipped.length > 0) {
      log.detail(`Left ${result.skipped.length} existing agent file(s) alone`);
    }
  }

  if (!options.noSearch) {
    const tree = await scanDokai({ dokaiRoot });
    const loaded = await loadSettings(dokaiRoot);
    const { specs } = loaded.project.openapi.enabled
      ? await scanOpenApiSpecs({ dokaiRoot, dir: loaded.project.openapi.dir })
      : { specs: [] };
    const indexPath = defaultSearchIndexPath(dokaiRoot);
    const index = await buildSearchIndex(tree, indexPath, { specs });
    log.success(`Built search index (${index.documents.length} docs) → ${indexPath}`);
  }
}

import { copyAgentAssets, patchAgentsMd } from 'dokai-ai';
import type { RepoShape } from 'dokai-core';

export interface ScaffoldAgentAssetsResult {
  written: string[];
  skipped: string[];
}

/**
 * Scaffold the agent-facing assets into a repo:
 *   - Claude Code (`claude`): `.claude/commands/` + `.claude/skills/dokai/`
 *   - Any other agent (`agents`): `.agents/skills/dokai/` + a managed block in root `AGENTS.md`
 *
 * Slash commands are Claude-specific; every other agent works from the skill and `AGENTS.md`
 * pointer. The `AGENTS.md` path is folded into `written`/`skipped` so it surfaces in summaries.
 */
export async function scaffoldAgentAssets(opts: {
  repoRoot: string;
  repoShape?: RepoShape;
  overwrite?: boolean;
  /** Scaffold Claude Code assets. Default `true`. */
  claude?: boolean;
  /** Scaffold agent-agnostic assets (`.agents/` + `AGENTS.md`). Default `true`. */
  agents?: boolean;
}): Promise<ScaffoldAgentAssetsResult> {
  const claude = opts.claude ?? true;
  const agents = opts.agents ?? true;

  const result = await copyAgentAssets({
    dest: opts.repoRoot,
    ...(opts.repoShape ? { repoShape: opts.repoShape } : {}),
    overwrite: opts.overwrite ?? false,
    claude,
    agents,
  });

  const written = [...result.written];
  const skipped = [...result.skipped];

  if (agents) {
    const patched = await patchAgentsMd({ dest: opts.repoRoot });
    if (patched.action === 'unchanged') skipped.push(patched.path);
    else written.push(patched.path);
  }

  return { written, skipped };
}

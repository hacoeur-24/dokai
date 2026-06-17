import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runDev } from './commands/dev.js';
import { runBuild } from './commands/build.js';
import { runPreview } from './commands/preview.js';
import { runGenerate } from './commands/generate.js';
import { runUpdate } from './commands/update.js';
import { runBump } from './commands/bump.js';
import { log } from './lib/log.js';
import type { BumpKind } from 'dokai-core/node';

const program = new Command();

program
  .name('dokai')
  .description('DOKAI — installable, local-first documentation product.')
  .version(__DOKAI_VERSION__);

program
  .command('init')
  .description(
    'Scaffold DOKAI in the current repo (creates DOKAI/, .claude/, .agents/, AGENTS.md, patches package.json + .gitignore).',
  )
  .option('--root <path>', 'Repository root (defaults to cwd).')
  .option('--yes', 'Skip interactive prompts and accept defaults.')
  .option('--no-claude', 'Skip Claude command/skill scaffolding (.claude/).')
  .option('--no-agents', 'Skip agent-agnostic scaffolding (.agents/ + AGENTS.md).')
  .option('--skip-scripts', 'Skip package.json script patching.')
  .option('--project-name <name>', 'Override the documentation project name.')
  .option('--workspace <name...>', 'Map only the named workspace package(s) to DOKAI sections.')
  .action(async (opts) => {
    await runInit({
      root: opts.root,
      yes: Boolean(opts.yes),
      noClaude: opts.claude === false,
      noAgents: opts.agents === false,
      skipScripts: Boolean(opts.skipScripts),
      projectName: opts.projectName,
      workspaces: opts.workspace,
    });
  });

program
  .command('dev')
  .description('Run the local documentation UI (Vite + middleware) on the configured port.')
  .option('--root <path>', 'Repository root.')
  .option('--port <number>', 'Override the default port (8128).', (v) => Number(v))
  .action(async (opts) => {
    await runDev({ root: opts.root, port: opts.port });
  });

program
  .command('build')
  .description('Produce a static read-only site to DOKAI/.dokai/dist/.')
  .option('--root <path>', 'Repository root.')
  .action(async (opts) => {
    await runBuild({ root: opts.root });
  });

program
  .command('preview')
  .description('Serve the static build for local verification.')
  .option('--root <path>', 'Repository root.')
  .option('--port <number>', 'Port to serve on.', (v) => Number(v))
  .action(async (opts) => {
    await runPreview({ root: opts.root, port: opts.port });
  });

program
  .command('generate')
  .description('Re-emit Claude + agent assets and the search index without launching dev.')
  .option('--root <path>', 'Repository root.')
  .option('--no-search', 'Skip the search index rebuild.')
  .option('--no-claude', 'Skip Claude command/skill re-emit (.claude/).')
  .option('--no-agents', 'Skip agent-agnostic re-emit (.agents/ + AGENTS.md).')
  .action(async (opts) => {
    await runGenerate({
      root: opts.root,
      noSearch: opts.search === false,
      noClaude: opts.claude === false,
      noAgents: opts.agents === false,
    });
  });

program
  .command('update')
  .description('Re-sync DOKAI-managed files (Claude templates, package.json scripts, .gitignore).')
  .option('--root <path>', 'Repository root.')
  .action(async (opts) => {
    await runUpdate({ root: opts.root });
  });

program
  .command('bump')
  .argument('<path>', 'Path to a markdown file or a folder containing _section.json.')
  .argument('<kind>', 'patch | minor | major')
  .description('Bump frontmatter version on a doc, or _section.json version on a folder.')
  .action(async (path: string, kind: string) => {
    if (kind !== 'patch' && kind !== 'minor' && kind !== 'major') {
      throw new Error(`bump: invalid kind "${kind}" — expected patch, minor, or major.`);
    }
    await runBump({ target: path, kind: kind as BumpKind });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error(message);
  process.exit(1);
});

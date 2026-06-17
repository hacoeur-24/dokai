import { resolve } from 'node:path';
import { statSync } from 'node:fs';
import { bumpDoc, bumpSection, type BumpKind } from 'dokai-core/node';
import { log } from '../lib/log.js';

export interface BumpOptions {
  target: string;
  kind: BumpKind;
}

/** Bump frontmatter version on a doc, or _section.json version on a folder. */
export async function runBump({ target, kind }: BumpOptions): Promise<void> {
  const absolute = resolve(target);
  const stat = statSync(absolute);
  if (stat.isDirectory()) {
    const result = await bumpSection(absolute, kind);
    log.success(`${result.before} → ${result.after}  ${result.path}`);
    return;
  }
  const result = await bumpDoc(absolute, kind);
  log.success(`${result.before} → ${result.after}  ${result.path}`);
}

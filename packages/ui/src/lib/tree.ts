import type { SectionNode } from 'dokai-core';

/**
 * Walk the manifest tree and return a flat list of every folder (excluding
 * the root itself), each annotated with its nesting depth (0 = top-level).
 */
export function flattenFolders(
  tree: SectionNode,
  depth = 0,
): { path: string; depth: number }[] {
  const out: { path: string; depth: number }[] = [];
  for (const child of tree.sections) {
    out.push({ path: child.relativePath, depth });
    out.push(...flattenFolders(child, depth + 1));
  }
  return out;
}

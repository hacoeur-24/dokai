import GithubSlugger from 'github-slugger';

/** Stable, GitHub-compatible heading slug. */
export function headingSlug(text: string): string {
  return new GithubSlugger().slug(text);
}

/**
 * Deduplicating slugger for a single document — call `next` for each heading in order so that
 * collisions are resolved with `-1`, `-2`, etc., matching GitHub's anchor behavior.
 */
export function createSlugger() {
  const slugger = new GithubSlugger();
  return {
    next(text: string): string {
      return slugger.slug(text);
    },
    reset() {
      slugger.reset();
    },
  };
}

/**
 * "Rollover" semver bump for the editor's auto-bump policy. Treats each segment as base-10 with
 * a hard cap at 9 (one digit), so the user gets ergonomic patch/minor/major rollovers when they
 * save without manually changing the version:
 *
 *   0.1.3  →  0.1.4   (patch under 9: bump patch)
 *   1.4.9  →  1.5.0   (patch is 9: bump minor, reset patch)
 *   0.9.9  →  1.0.0   (patch and minor are 9: bump major, reset both)
 *
 * Differs from `semver.inc('patch')` deliberately — this is a UX-tuned bump tied to the Save
 * confirmation flow, not a strict semver operation. CLI `dokai bump` keeps standard
 * semver semantics.
 */
export function rolloverBump(version: string): string {
  const parsed = parseVersion(version);
  if (!parsed) {
    throw new Error(
      `Invalid version "${version}" — expected major.minor.patch with single-digit segments.`,
    );
  }
  let { major, minor, patch } = parsed;
  if (patch < 9) {
    patch += 1;
  } else if (minor < 9) {
    patch = 0;
    minor += 1;
  } else {
    patch = 0;
    minor = 0;
    major += 1;
  }
  return `${major}.${minor}.${patch}`;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(version: string): ParsedVersion | null {
  const m = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if ([major, minor, patch].some((n) => Number.isNaN(n))) return null;
  return { major, minor, patch };
}

/** Returns null when the version is malformed — caller can fall back to leaving it alone. */
export function safeRolloverBump(version: string): string | null {
  try {
    return rolloverBump(version);
  } catch {
    return null;
  }
}

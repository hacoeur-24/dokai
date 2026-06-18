import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Renders the project logo configured in `settings.json#logo`. Path can be:
 *   - Absolute URL (`https://...`) → used directly
 *   - Relative path (`./assets/logo.svg`) → served via `/dokai-asset?path=...` from DOKAI/
 * Falls back to the BookOpen icon when the path is empty or the image fails to load.
 */
export function ProjectLogo({ src, alt }: { src?: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const trimmed = src?.trim();
  // Conventions:
  //   "https://..."    → use the URL directly
  //   "./foo" or "foo" → relative to DOKAI/
  //   "/foo"           → relative to the repo root (e.g. "/public/logo.svg")
  //   "../foo"         → relative to DOKAI/, escaping into the repo
  const url = trimmed
    ? /^https?:\/\//.test(trimmed)
      ? trimmed
      : `/dokai-asset?path=${encodeURIComponent(trimmed)}`
    : null;

  // Reset the broken flag whenever the source changes — without this, a previously failed
  // URL (e.g. an HTML page mistakenly used as an image) leaves `broken` stuck at true and
  // the next valid path silently falls back to BookOpen instead of attempting to load.
  useEffect(() => {
    setBroken(false);
  }, [url]);

  if (!url || broken) {
    return <BookOpen className="h-5 w-5 shrink-0" style={{ color: 'var(--color-accent)' }} />;
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-5 w-5 shrink-0 object-contain"
      onError={() => setBroken(true)}
    />
  );
}

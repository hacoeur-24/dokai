import { useEffect, useRef, useState } from 'react';
import { renderMermaid } from '../lib/mermaid.js';
import { Maximize2, Code2 } from 'lucide-react';
import { FullscreenDiagram } from './FullscreenDiagram.js';

export function DiagramFrame({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Re-render the SVG whenever we re-mount the host div. `showSource` is in the deps so that
  // toggling out of source view re-renders into the freshly-mounted container ref (the
  // previous ref was for a different element that no longer exists).
  useEffect(() => {
    if (showSource) return;
    let cancelled = false;
    const node = containerRef.current;
    if (!node) return;
    const theme = (document.documentElement.dataset['theme'] ?? 'light') as 'light' | 'dark';
    renderMermaid(source, theme)
      .then(({ svg }) => {
        if (cancelled || !node) return;
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
        node.replaceChildren(parsed.documentElement);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [source, showSource]);

  return (
    <>
      <figure
        className="my-6 overflow-hidden rounded-card border bg-bg"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div
          className="flex items-center justify-between border-b px-3 py-1.5 text-xs"
          style={{ color: 'var(--color-fg-subtle)' }}
        >
          <span className="font-mono">mermaid</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSource((v) => !v)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-muted"
              title="Toggle source"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>{showSource ? 'rendered' : 'source'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-muted"
              title="Open fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {error ? (
          <pre className="m-0 px-4 py-3 text-sm" style={{ color: 'var(--color-danger)' }}>
            Diagram error: {error}
          </pre>
        ) : showSource ? (
          <pre className="m-0 px-4 py-3 text-xs" style={{ background: 'var(--color-bg-subtle)' }}>
            {source}
          </pre>
        ) : (
          <div
            ref={containerRef}
            className="flex cursor-zoom-in justify-center px-4 py-5"
            onClick={() => setFullscreen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setFullscreen(true);
              }
            }}
          />
        )}
      </figure>

      {fullscreen && <FullscreenDiagram source={source} onClose={() => setFullscreen(false)} />}
    </>
  );
}

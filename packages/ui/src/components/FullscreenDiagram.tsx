import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Download, X, FileImage, FileCode2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { renderMermaid } from '../lib/mermaid.js';
import { downloadPng, downloadSvg } from '../lib/diagram-export.js';
import { useT } from '../i18n/index.js';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const BUTTON_ZOOM_STEP = 1.25;
const FIT_PADDING = 40;
const FIT_MAX = 1.5;

export function FullscreenDiagram({ source, onClose }: { source: string; onClose: () => void }) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const naturalSizeRef = useRef<{ width: number; height: number } | null>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Resize the SVG to `next * naturalSize` and adjust scroll so the cursor (or viewport center
  // when no anchor is given) stays over the same point in the diagram. Reading the SVG's
  // post-resize bounding rect handles the flex-centering case where small diagrams sit padded
  // inside the scroll area — pure scrollLeft/scrollTop math wouldn't account for that padding.
  const applyScale = useCallback((next: number, anchor?: { clientX: number; clientY: number }) => {
    const scrollArea = scrollRef.current;
    const svg = containerRef.current?.querySelector('svg') as SVGElement | null;
    const natural = naturalSizeRef.current;
    if (!scrollArea || !svg || !natural) return;

    const current = scaleRef.current;
    const clamped = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    if (clamped === current) return;

    const scrollRect = scrollArea.getBoundingClientRect();
    const ax = anchor ? anchor.clientX : scrollRect.left + scrollRect.width / 2;
    const ay = anchor ? anchor.clientY : scrollRect.top + scrollRect.height / 2;

    const beforeRect = svg.getBoundingClientRect();
    const offsetX = ax - beforeRect.left;
    const offsetY = ay - beforeRect.top;
    const ratio = clamped / current;

    svg.style.width = `${natural.width * clamped}px`;
    svg.style.height = `${natural.height * clamped}px`;

    const afterRect = svg.getBoundingClientRect();
    const targetX = afterRect.left + offsetX * ratio;
    const targetY = afterRect.top + offsetY * ratio;
    scrollArea.scrollLeft += targetX - ax;
    scrollArea.scrollTop += targetY - ay;

    scaleRef.current = clamped;
    setScale(clamped);
  }, []);

  const fitToScreen = useCallback(() => {
    const scrollArea = scrollRef.current;
    const svg = containerRef.current?.querySelector('svg') as SVGElement | null;
    const natural = naturalSizeRef.current;
    if (!scrollArea || !svg || !natural) return;

    const availW = Math.max(scrollArea.clientWidth - FIT_PADDING, 0);
    const availH = Math.max(scrollArea.clientHeight - FIT_PADDING, 0);
    const fit = Math.min(availW / natural.width, availH / natural.height, FIT_MAX);
    const clamped = Math.min(Math.max(fit, MIN_SCALE), MAX_SCALE);

    svg.style.width = `${natural.width * clamped}px`;
    svg.style.height = `${natural.height * clamped}px`;
    scrollArea.scrollLeft = (scrollArea.scrollWidth - scrollArea.clientWidth) / 2;
    scrollArea.scrollTop = (scrollArea.scrollHeight - scrollArea.clientHeight) / 2;

    scaleRef.current = clamped;
    setScale(clamped);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const node = containerRef.current;
    if (!node) return;
    const theme = (document.documentElement.dataset['theme'] ?? 'light') as 'light' | 'dark';
    renderMermaid(source, theme)
      .then(({ svg }) => {
        if (cancelled || !node) return;
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const svgEl = parsed.documentElement as unknown as SVGSVGElement;
        // Strip Mermaid's responsive sizing so the explicit width/height we set below stick.
        svgEl.style.maxWidth = 'none';
        svgEl.style.maxHeight = 'none';
        svgEl.style.display = 'block';
        node.replaceChildren(svgEl);

        let width = 0;
        let height = 0;
        const viewBox = svgEl.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(/\s+/).map(Number);
          width = parts[2] ?? 0;
          height = parts[3] ?? 0;
        }
        if (!width || !height) {
          const rect = svgEl.getBoundingClientRect();
          width = rect.width;
          height = rect.height;
        }
        if (width > 0 && height > 0) {
          naturalSizeRef.current = { width, height };
          fitToScreen();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [source, fitToScreen]);

  // Trackpad pinch and Ctrl/Cmd + wheel both arrive as wheel events with ctrlKey set. We
  // preventDefault on those so the browser doesn't apply page zoom, and translate them into
  // diagram zoom instead. Plain wheel/two-finger scroll falls through to native overflow
  // scrolling on the container, which acts as panning when the diagram overflows.
  useEffect(() => {
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.01);
      applyScale(scaleRef.current * factor, {
        clientX: e.clientX,
        clientY: e.clientY,
      });
    };
    scrollArea.addEventListener('wheel', handler, { passive: false });
    return () => scrollArea.removeEventListener('wheel', handler);
  }, [applyScale]);

  const findSvg = (): SVGElement | null => containerRef.current?.querySelector('svg') ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]"
      style={{ backdropFilter: 'blur(2px)' }}
    >
      <header className="flex items-center justify-between border-b px-5 py-3">
        <p className="dokai-eyebrow">{t('diagram.title')}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(source);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-1.5 text-sm hover:bg-[var(--color-bg-muted)]"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? t('diagram.copied') : t('diagram.copySource')}
          </button>
          <button
            type="button"
            onClick={() => {
              const svg = findSvg();
              if (svg) downloadSvg(svg, 'diagram');
            }}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-1.5 text-sm hover:bg-[var(--color-bg-muted)]"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            {t('diagram.downloadSvg')}
          </button>
          <button
            type="button"
            onClick={async () => {
              const svg = findSvg();
              if (svg) await downloadPng(svg, 'diagram');
            }}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-1.5 text-sm hover:bg-[var(--color-bg-muted)]"
          >
            <FileImage className="h-3.5 w-3.5" />
            {t('diagram.downloadPng')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-1.5 text-sm hover:bg-[var(--color-bg-muted)]"
            title={t('diagram.close')}
          >
            <X className="h-3.5 w-3.5" />
            {t('diagram.close')}
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        {error ? (
          <pre className="p-8 text-sm" style={{ color: 'var(--color-danger)' }}>
            {error}
          </pre>
        ) : (
          <div className="flex min-h-full min-w-full items-center justify-center p-8">
            <div ref={containerRef} />
          </div>
        )}
      </div>

      {!error && (
        <div
          className="absolute bottom-4 right-4 flex items-center gap-1 rounded-[var(--radius-control)] border bg-[var(--color-bg)] p-1 text-sm"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <button
            type="button"
            onClick={() => applyScale(scaleRef.current / BUTTON_ZOOM_STEP)}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--color-bg-muted)] disabled:opacity-40"
            disabled={scale <= MIN_SCALE + 1e-3}
            title={t('diagram.zoomOut')}
            aria-label={t('diagram.zoomOut')}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span
            className="min-w-[3.25rem] text-center text-xs tabular-nums"
            style={{ color: 'var(--color-fg-subtle)' }}
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => applyScale(scaleRef.current * BUTTON_ZOOM_STEP)}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--color-bg-muted)] disabled:opacity-40"
            disabled={scale >= MAX_SCALE - 1e-3}
            title={t('diagram.zoomIn')}
            aria-label={t('diagram.zoomIn')}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={fitToScreen}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--color-bg-muted)]"
            title={t('diagram.fit')}
            aria-label={t('diagram.fit')}
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Re-export so the icon Download remains tree-shaken if unused — left here for future tooltips.
export { Download };

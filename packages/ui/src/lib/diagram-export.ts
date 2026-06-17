/**
 * Helpers for downloading rendered Mermaid diagrams as SVG or PNG. SVG is extracted from the
 * already-rendered DOM. PNG is rasterized via an offscreen canvas — works fully in the browser
 * with no external service.
 */

export function downloadSvg(svgElement: SVGElement, filename: string): void {
  const cloned = svgElement.cloneNode(true) as SVGElement;
  // Make sure the export carries explicit width/height for downstream tools.
  const bbox = (
    svgElement as unknown as { getBoundingClientRect: () => DOMRect }
  ).getBoundingClientRect();
  if (!cloned.getAttribute('width')) cloned.setAttribute('width', String(Math.round(bbox.width)));
  if (!cloned.getAttribute('height'))
    cloned.setAttribute('height', String(Math.round(bbox.height)));
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const xml = new XMLSerializer().serializeToString(cloned);
  const blob = new Blob([`<?xml version="1.0" standalone="no"?>\n${xml}`], {
    type: 'image/svg+xml;charset=utf-8',
  });
  triggerDownload(blob, `${filename}.svg`);
}

export async function downloadPng(
  svgElement: SVGElement,
  filename: string,
  { scale = 2 }: { scale?: number } = {},
): Promise<void> {
  const bbox = (
    svgElement as unknown as { getBoundingClientRect: () => DOMRect }
  ).getBoundingClientRect();
  const width = Math.max(1, Math.round(bbox.width));
  const height = Math.max(1, Math.round(bbox.height));

  const cloned = svgElement.cloneNode(true) as SVGElement;
  cloned.setAttribute('width', String(width));
  cloned.setAttribute('height', String(height));
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const xml = new XMLSerializer().serializeToString(cloned);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!blob) throw new Error('Canvas toBlob returned null');
    triggerDownload(blob, `${filename}.png`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (ev) => reject(new Error(`Image load failed: ${String(ev)}`));
    img.src = src;
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

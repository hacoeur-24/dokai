import { docDownloadUrl } from './api.js';

export type DownloadFormat = 'markdown' | 'pdf';

/**
 * Download the *target* document. Both formats hit route-scoped server endpoints, so the
 * file you get is always the doc you asked for — independent of which page is currently
 * displayed.
 *
 *   markdown → GET /api/doc/raw?route=…   (streams the .md file)
 *   pdf      → GET /api/doc/pdf?route=…   (server-side Puppeteer renders a real text PDF)
 */
export async function downloadDoc(input: {
  route: string;
  relativePath: string;
  format: DownloadFormat;
}): Promise<void> {
  if (input.format === 'markdown') {
    const a = document.createElement('a');
    a.href = docDownloadUrl(input.route);
    a.download = input.relativePath.split('/').pop() ?? 'document.md';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  // PDF — server-rendered via Puppeteer. Fetch the binary blob and trigger a browser save.
  // No browser print dialog at any point; this is a real text-selectable PDF.
  const url = `/api/doc/pdf?route=${encodeURIComponent(input.route)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PDF generation failed (${res.status}): ${text || res.statusText}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const filename = (input.relativePath.split('/').pop() ?? 'document.md').replace(/\.md$/i, '.pdf');
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
}

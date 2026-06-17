import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { loadSettings, parseDocFile, routeToPath, type Frontmatter } from 'dokai-core/node';
import { existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/**
 * Render a single doc to a PDF Buffer using Puppeteer-controlled headless Chrome.
 *
 * Pipeline:
 *  1. Load + parse the markdown file (frontmatter + body).
 *  2. Convert body markdown → HTML via the unified/remark pipeline. Mermaid fences are
 *     rewritten to `<pre class="mermaid">` so the bundled Mermaid script picks them up.
 *  3. Build a self-contained HTML page (embedded CSS, embedded title/description header,
 *     CDN-loaded Mermaid script).
 *  4. Launch the user's installed Chrome via `chrome-launcher` (no Chromium download).
 *  5. Load the HTML, wait for Mermaid to render, then call `page.pdf()`. The result is
 *     real text-selectable PDF — not a screenshot.
 */
export async function renderDocPdf(opts: {
  repoRoot: string;
  route: string;
}): Promise<{ buffer: Uint8Array; filename: string }> {
  const dokaiRoot = join(opts.repoRoot, 'DOKAI');
  const relativePath = routeToPath(opts.route);
  const target = resolveSafe(dokaiRoot, relativePath);
  if (!target || !existsSync(target)) {
    throw new Error(`No doc for route "${opts.route}"`);
  }

  const parsed = await parseDocFile(target);
  const settings = await loadSettings(dokaiRoot);
  const html = await buildPrintableHtml({
    frontmatter: parsed.frontmatter,
    bodyMarkdown: parsed.bodyMarkdown,
    primaryColor: settings.project.theme.primaryColor,
    projectName: settings.project.projectName,
  });

  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      'Chrome / Chromium not found on this machine. Install Google Chrome (or any Chromium-based browser) and try again.',
    );
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();

    // Security: the printed page is built from doc markdown that may originate in an untrusted
    // repository. Deny every network request except the two hosts the print template needs
    // (the Mermaid CDN and the Inter font host). This stops a malicious doc from using an
    // image URL or any subresource to reach internal/cloud-metadata endpoints (SSRF) or to
    // exfiltrate data. data:/blob:/about: carry no external traffic and are allowed; file:// is
    // denied so a doc cannot read local files.
    const ALLOWED_HOSTS = new Set(['cdn.jsdelivr.net', 'rsms.me']);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      let url: URL;
      try {
        url = new URL(request.url());
      } catch {
        void request.abort();
        return;
      }
      if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') {
        void request.continue();
        return;
      }
      if (
        (url.protocol === 'https:' || url.protocol === 'http:') &&
        ALLOWED_HOSTS.has(url.hostname)
      ) {
        void request.continue();
        return;
      }
      void request.abort();
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });
    // Mermaid bootstraps on DOMContentLoaded but its SVG labels take a few frames to settle.
    // networkidle0 already waits for fonts/images; this extra 200ms covers lazy SVG measure.
    await new Promise((r) => setTimeout(r, 200));

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '18mm', right: '18mm', bottom: '20mm', left: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;color:#999;width:100%;padding:0 18mm;"></div>`,
      footerTemplate: `<div style="font-size:8px;color:#999;width:100%;padding:0 18mm;display:flex;justify-content:space-between;">
        <span>${escapeHtml(parsed.frontmatter.title)}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    });

    const filename = (relativePath.split('/').pop() ?? 'document.md').replace(/\.md$/i, '.pdf');
    return { buffer: pdf, filename };
  } finally {
    await browser.close();
  }
}

interface PrintableHtmlInput {
  frontmatter: Frontmatter;
  bodyMarkdown: string;
  primaryColor: string;
  projectName: string;
}

async function buildPrintableHtml(input: PrintableHtmlInput): Promise<string> {
  // Pre-process mermaid blocks: remark-rehype emits ```mermaid``` as <pre><code class="language-mermaid">.
  // Mermaid-CDN looks for elements with class "mermaid" (no nested <code>). We rewrite them in
  // a post-processing step on the rendered HTML.
  //
  // Security: raw HTML embedded in a doc is intentionally NOT rendered (no rehype-raw /
  // allowDangerousHtml). The doc markdown can come from an untrusted repository, and the live
  // UI (react-markdown) does not render raw HTML either, so this keeps the PDF consistent with
  // the app while preventing script/HTML injection into the headless Chrome that prints it.
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(input.bodyMarkdown);

  const bodyHtml = String(file.value).replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_match, source) => `<pre class="mermaid">${decodeHtml(String(source))}</pre>`,
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.frontmatter.title)} — ${escapeHtml(input.projectName)}</title>
<link rel="preconnect" href="https://rsms.me/" />
<link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
<style>
  :root {
    --accent: ${input.primaryColor};
    --fg: #1c1c1c;
    --fg-muted: #525252;
    --fg-subtle: #888;
    --border: #e5e7eb;
    --bg-subtle: #f7f7f7;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--fg);
    line-height: 1.6;
    font-size: 11pt;
    -webkit-font-smoothing: antialiased;
  }
  .doc-header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
  .doc-eyebrow {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-subtle);
    font-weight: 600;
  }
  .doc-title { font-size: 22pt; font-weight: 600; margin: 6px 0 4px; letter-spacing: -0.02em; }
  .doc-description { color: var(--fg-muted); font-size: 11pt; margin: 0; }
  .doc-meta {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 8.5pt;
    color: var(--fg-subtle);
  }
  .doc-meta .chip {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 2px 8px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    background: var(--bg-subtle);
  }
  h1, h2, h3, h4 { color: var(--fg); letter-spacing: -0.015em; page-break-after: avoid; }
  h1 { font-size: 18pt; margin: 24px 0 8px; }
  h2 { font-size: 14pt; margin: 20px 0 8px; padding-top: 10px; border-top: 1px solid var(--border); }
  h3 { font-size: 12pt; margin: 16px 0 6px; }
  h4 { font-size: 10.5pt; margin: 12px 0 4px; color: var(--fg-muted); }
  p, ul, ol, blockquote, table, pre, figure { page-break-inside: avoid; }
  p { margin: 8px 0; }
  ul, ol { padding-left: 22px; margin: 8px 0; }
  li { margin: 3px 0; }
  a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  code:not(pre code) {
    background: var(--bg-subtle);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.88em;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  pre {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.5;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  pre code { background: transparent; padding: 0; }
  blockquote {
    border-left: 3px solid color-mix(in oklch, var(--accent) 40%, transparent);
    padding: 6px 14px;
    color: var(--fg-muted);
    margin: 12px 0;
    background: color-mix(in oklch, var(--accent) 6%, transparent);
    border-radius: 0 4px 4px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin: 12px 0;
  }
  th, td { border-bottom: 1px solid var(--border); padding: 5px 8px; text-align: left; }
  th { font-weight: 600; color: var(--fg-muted); }
  hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
  .mermaid {
    background: white;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    margin: 14px 0;
    text-align: center;
  }
  .mermaid svg { max-width: 100%; height: auto; }
</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'strict' });
</script>
</head>
<body>
  <header class="doc-header">
    <div class="doc-eyebrow">${escapeHtml(input.projectName)}</div>
    <h1 class="doc-title">${escapeHtml(input.frontmatter.title)}</h1>
    <p class="doc-description">${escapeHtml(input.frontmatter.description)}</p>
    <div class="doc-meta">
      ${input.frontmatter.status ? `<span class="chip">${escapeHtml(input.frontmatter.status)}</span>` : ''}
      <span class="chip">v${escapeHtml(input.frontmatter.version)}</span>
      ${input.frontmatter.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}
    </div>
  </header>
  <main>
    ${bodyHtml}
  </main>
</body>
</html>`;
}

function findChrome(): string | null {
  try {
    const installs = Launcher.getInstallations();
    return installs[0] ?? null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function resolveSafe(dokaiRoot: string, relativePath: string): string | null {
  const target = resolve(dokaiRoot, relativePath);
  const root = resolve(dokaiRoot);
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

import mermaid from 'mermaid';

let initialized = false;
let counter = 0;

function ensureInit(theme: 'light' | 'dark'): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
  });
  initialized = true;
}

export interface RenderResult {
  svg: string;
  bindFunctions?: (element: HTMLElement) => void;
}

/** Render a Mermaid source to SVG, with the current theme. */
export async function renderMermaid(
  source: string,
  theme: 'light' | 'dark',
): Promise<RenderResult> {
  if (!initialized) ensureInit(theme);
  const id = `mermaid-${++counter}`;
  return mermaid.render(id, source);
}

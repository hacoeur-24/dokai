import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Pencil, Link2, Check } from 'lucide-react';
import type { DocNode } from 'dokai-core';
import { fetchDoc } from '../lib/api.js';
import { DiagramFrame } from './DiagramFrame.js';
import { DownloadDropdown } from './DownloadDropdown.js';
import { Tag } from './Tag.js';
import { useT } from '../i18n/index.js';

export function DocView() {
  const t = useT();
  const params = useParams<{ '*': string }>();
  const subpath = params['*'] ?? '';
  const route = subpath ? `/dokai/${subpath}` : '/dokai';
  const [doc, setDoc] = useState<DocNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDoc(null);
    setError(null);
    fetchDoc(route)
      .then(setDoc)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [route]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleShare = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy URL to clipboard:', err);
    }
  };

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Document not found</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          {error}
        </p>
      </div>
    );
  }

  if (!doc) {
    return <DocViewSkeleton />;
  }

  const { frontmatter, bodyMarkdown } = doc;
  return (
    <article>
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="dokai-eyebrow">{routeBreadcrumb(doc.route)}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{frontmatter.title}</h1>
            <p className="mt-2 text-[1.02rem]" style={{ color: 'var(--color-fg-muted)' }}>
              {frontmatter.description}
            </p>
          </div>
          <div className="dokai-doc-actions mt-1 flex shrink-0 items-center gap-1.5">
            <DownloadDropdown route={doc.route} relativePath={doc.relativePath} />
            <button
              type="button"
              onClick={() => void handleShare()}
              title={copied ? t('doc.shareCopied') : t('doc.share')}
              aria-label={copied ? t('doc.shareCopied') : t('doc.share')}
              className="dokai-icon-button h-8.5 w-8.5"
              style={copied ? { color: 'var(--color-success)' } : undefined}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            </button>
            <Link
              to={`${route}?edit=1`}
              className="inline-flex items-center gap-1.5 rounded-control border bg-(--color-surface) px-3 py-1.5 text-sm transition hover:bg-surface-hover"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('doc.editButton')}
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {frontmatter.status && <Tag tone="status">{t(`status.${frontmatter.status}`)}</Tag>}
          <Tag tone="version">v{frontmatter.version}</Tag>
          {frontmatter.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </header>

      <div className="prose-doc">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug]}
          components={{
            code({ className, children, ...rest }) {
              const langMatch = (className ?? '').match(/language-(\w+)/);
              const lang = langMatch ? langMatch[1] : undefined;
              if (lang === 'mermaid') {
                return <DiagramFrame source={String(children).trimEnd()} />;
              }
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            },
          }}
        >
          {bodyMarkdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}

function routeBreadcrumb(route: string): string {
  const parts = route
    .replace(/^\/dokai\/?/, '')
    .split('/')
    .filter(Boolean);
  if (parts.length === 0) return 'Documentation';
  return parts.join(' / ');
}

function DocViewSkeleton() {
  return (
    <div>
      <div className="h-3 w-24 animate-pulse rounded bg-bg-muted" />
      <div className="mt-4 h-9 w-3/4 animate-pulse rounded bg-bg-muted" />
      <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-bg-muted" />
      <div className="mt-10 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-bg-muted" />
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { createApiReference } from '@scalar/api-reference';
import '@scalar/api-reference/style.css';
import { useManifest, useSettings } from '../state.js';
import { buildScalarConfig, findSpecByRoute, rawSpecUrl } from '../lib/openapi.js';
import { useResolvedTheme } from '../lib/theme.js';
import { useT } from '../i18n/index.js';

export function OpenApiExplorer() {
  const params = useParams<{ '*': string }>();
  const subpath = params['*'] ?? '';
  const route = subpath ? `/dokai/_api/${subpath}` : '/dokai/_api';

  const manifest = useManifest();
  const settings = useSettings();
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);

  const spec = useMemo(
    () => (manifest.data ? findSpecByRoute(manifest.data.specs, route) : null),
    [manifest.data, route],
  );
  const tryItOut = manifest.data?.capabilities.tryItOut ?? false;
  const persistAuth = settings.data?.project.openapi.persistAuth ?? true;
  const mode = useResolvedTheme();

  // Re-mount Scalar on theme change so its named theme + light/dark follow DOKAI's. The
  // entered bearer token survives the re-mount via persistAuth (localStorage); only scroll/
  // expansion state resets, which is acceptable for an infrequent theme toggle.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !spec) return;
    const app = createApiReference(
      el,
      buildScalarConfig({ rawUrl: rawSpecUrl(spec.relativePath), tryItOut, persistAuth, mode }),
    );
    return () => {
      app.destroy();
    };
  }, [spec, tryItOut, persistAuth, mode]);

  if (!manifest.data) return null;
  if (manifest.data && !spec) {
    return <p style={{ color: 'var(--color-fg-subtle)' }}>{t('openapi.specNotFound', { route })}</p>;
  }
  return <div ref={containerRef} className="dokai-openapi-explorer" />;
}

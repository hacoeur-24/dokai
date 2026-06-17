import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'node22',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  // Externalize all `dependencies`. CJS deps (fast-glob, gray-matter, etc.) resolved at install
  // time via node_modules. Bundling them into ESM produces dynamic-require errors at runtime.
  banner: { js: '#!/usr/bin/env node' },
  define: { __DOKAI_VERSION__: JSON.stringify(pkg.version) },
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'plugin/index': 'plugin/index.ts' },
  format: ['esm'],
  target: 'node22',
  dts: { resolve: true },
  sourcemap: true,
  clean: false,
  splitting: false,
  outDir: 'dist',
  tsconfig: 'tsconfig.plugin.json',
  external: ['vite', 'react', 'react-dom'],
});

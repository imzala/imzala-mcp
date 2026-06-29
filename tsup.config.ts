import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'bin/stdio': 'src/bin/stdio.ts' },
    format: ['esm'],
    target: 'node20',
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    outDir: 'dist',
    clean: true,
    dts: false,
    sourcemap: false,
  },
  {
    entry: { server: 'src/server.ts' },
    format: ['esm'],
    target: 'node20',
    platform: 'node',
    outDir: 'dist',
    clean: false,
    dts: true,
    sourcemap: true,
  },
]);

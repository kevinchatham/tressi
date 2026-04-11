import { defineConfig } from 'tsup';

export default defineConfig([
  {
    clean: true,
    dts: false,
    entry: ['src/index.ts'],
    format: ['cjs'],
    outDir: 'dist',
    sourcemap: true,
    tsconfig: 'tsconfig.app.json',
  },
  {
    banner: {
      js: '#!/usr/bin/env node',
    },
    clean: true,
    dts: false,
    entry: ['src/cli.ts'],
    format: ['cjs'],
    outDir: 'dist',
    sourcemap: true,
    tsconfig: 'tsconfig.app.json',
  },
  {
    clean: true,
    dts: false,
    entry: ['src/workers/worker-thread.ts'],
    format: ['cjs'],
    outDir: 'dist/workers',
    sourcemap: true,
    tsconfig: 'tsconfig.app.json',
  },
]);

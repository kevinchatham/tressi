import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: '../../dist',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    tsconfig: 'tsconfig.json',
  },
  {
    entry: ['src/cli.ts'],
    outDir: '../../dist',
    format: ['cjs'],
    sourcemap: true,
    clean: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
    tsconfig: 'tsconfig.json',
  },
  {
    entry: ['src/workers/worker-thread.ts'],
    outDir: '../../dist/workers',
    format: ['cjs'],
    sourcemap: true,
    clean: false,
    tsconfig: 'tsconfig.json',
  },
]);

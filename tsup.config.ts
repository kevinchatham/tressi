import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: ['src/cli.ts'],
    outDir: 'dist',
    format: ['cjs'],
    sourcemap: true,
    clean: false, // Don't clean the dist folder for the second entry
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]); 
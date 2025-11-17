import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: '../../dist/common',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    tsconfig: 'tsconfig.json',
  },
]);

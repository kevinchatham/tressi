import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/index.ts'],
  outDir: 'dist',
  format: ['cjs'], // or ['esm']
  dts: true,
  sourcemap: true,
  clean: true,
  tsconfig: 'tsconfig.json',
});

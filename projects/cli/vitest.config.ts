import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'scripts/',
        'schemas/',
      ],
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    globals: true,
    hookTimeout: 5000,
    include: ['src/**/*.spec.ts'],
    teardownTimeout: 5000,
    testTimeout: 5000,
  },
});

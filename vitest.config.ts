import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['tests/setup/test-setup.ts'],
    include: [
      'tests/e2e/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/performance/**/*.test.ts',
      'tests/server/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'tests/workers/**/*.test.ts',
    ],
    exclude: ['tests/utils/**', 'tests/setup/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'scripts/',
        'schemas/',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 60000, // Increased for worker tests
    hookTimeout: 20000,
    teardownTimeout: 20000,
    threads: false, // Disable Vitest threads for worker testing
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['tests/setupTests.ts'],
    testTimeout: 30000, // 30 seconds for CLI tests
  },
});

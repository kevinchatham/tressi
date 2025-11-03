import { afterAll, beforeAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
  // Increase timeout for integration tests
  vi.setConfig({ testTimeout: 30000 });
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

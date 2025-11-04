import { afterAll, vi } from 'vitest';

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

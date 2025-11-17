import * as net from 'net';

import type { TressiConfig } from '../../src/types/index';

/**
 * Standard test configuration that includes all required fields
 */
export const createTestConfig = (
  overrides: Partial<TressiConfig> = {},
): TressiConfig => ({
  $schema:
    'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
  requests: [
    {
      url: 'http://localhost:8080/test',
      method: 'GET',
      rps: 10,
    },
  ],
  options: {
    durationSec: 5,
    rampUpTimeSec: 0,
    useUI: false,
    silent: true,
    earlyExitOnError: false,
    workerMemoryLimit: 128,
    workerEarlyExit: {
      enabled: false,
      monitoringWindowMs: 1000,
      stopMode: 'endpoint',
    },
    ...overrides.options,
  },
  ...overrides,
});

/**
 * Worker-specific test configuration
 */
export const createWorkerTestConfig = (
  overrides: Partial<TressiConfig> = {},
): TressiConfig => ({
  ...createTestConfig(),
  options: {
    ...createTestConfig().options,
    threads: 2,
    ...overrides.options,
  },
  ...overrides,
});

/**
 * Minimal test configuration for simple tests
 */
export const createMinimalTestConfig = (
  overrides: Partial<TressiConfig> = {},
): TressiConfig => ({
  $schema:
    'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
  requests: [
    {
      url: 'http://localhost:8080/test',
      method: 'GET',
      rps: 1,
    },
  ],
  options: {
    durationSec: 1,
    rampUpTimeSec: 0,
    useUI: false,
    silent: true,
    earlyExitOnError: false,
    workerMemoryLimit: 64,
    workerEarlyExit: {
      enabled: false,
      monitoringWindowMs: 1000,
      stopMode: 'endpoint',
    },
    ...overrides.options,
  },
  ...overrides,
});

/**
 * Gets an available port for testing
 */
export const getAvailablePort = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
};

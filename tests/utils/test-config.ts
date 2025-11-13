import type { TressiConfig } from '../../src/types';

/**
 * Creates a properly typed test configuration with all required fields
 */
export function createTestConfig(
  overrides: Partial<TressiConfig> = {},
): TressiConfig {
  return {
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
  };
}

/**
 * Creates a worker-specific test configuration
 */
export function createWorkerTestConfig(
  overrides: Partial<TressiConfig> = {},
): TressiConfig {
  return createTestConfig({
    options: {
      threads: 2,
      ...overrides.options,
    },
    ...overrides,
  });
}

/**
 * Creates a minimal test configuration for simple tests
 */
export function createMinimalTestConfig(
  overrides: Partial<TressiConfig> = {},
): TressiConfig {
  return {
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
  };
}

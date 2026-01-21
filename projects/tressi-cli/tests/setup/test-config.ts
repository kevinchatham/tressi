import { TressiConfig } from '../../src/common/config/types';

/**
 * Creates a properly typed test configuration with all required fields
 */
export function createTestConfig(
  overrides: Partial<TressiConfig> = {},
): TressiConfig {
  const baseConfig: TressiConfig = {
    $schema:
      'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
    requests: [
      {
        url: 'http://localhost:8080/test',
        method: 'GET',
        rps: 10,
        rampUpDurationSec: 0,
        payload: {},
        headers: {},
        earlyExit: {
          enabled: false,
          errorRateThreshold: 0,
          exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
          monitoringWindowMs: 5000,
        },
      },
    ],
    options: {
      durationSec: 5,
      silent: true,
      headers: {},
      exportPath: '',
      threads: 4,
      workerMemoryLimit: 128,
      workerEarlyExit: {
        enabled: false,
        errorRateThreshold: 0,
        exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
        monitoringWindowMs: 5000,
      },
    },
  };

  return {
    ...baseConfig,
    ...overrides,
    requests: overrides.requests || baseConfig.requests,
    options: {
      ...baseConfig.options,
      ...overrides.options,
    },
  };
}

/**
 * Creates a worker-specific test configuration
 */
export function createWorkerTestConfig(
  overrides: Partial<TressiConfig> = {},
): TressiConfig {
  const baseConfig = createTestConfig();
  return {
    ...baseConfig,
    ...overrides,
    options: {
      ...baseConfig.options,
      threads: 2,
      ...(overrides.options || {}),
    },
  };
}

/**
 * Creates a minimal test configuration for simple tests
 */
export function createMinimalTestConfig(
  overrides: Partial<TressiConfig> = {},
): TressiConfig {
  const baseConfig: TressiConfig = {
    $schema:
      'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
    requests: [
      {
        url: 'http://localhost:8080/test',
        method: 'GET',
        rps: 1,
        rampUpDurationSec: 0,
        payload: {},
        headers: {},
        earlyExit: {
          enabled: false,
          errorRateThreshold: 0,
          exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
          monitoringWindowMs: 5000,
        },
      },
    ],
    options: {
      durationSec: 1,
      silent: true,
      headers: {},
      exportPath: '',
      threads: 4,
      workerMemoryLimit: 64,
      workerEarlyExit: {
        enabled: false,
        errorRateThreshold: 0,
        exitStatusCodes: [400, 401, 403, 500, 502, 503, 504],
        monitoringWindowMs: 5000,
      },
    },
  };

  return {
    ...baseConfig,
    ...overrides,
    requests: overrides.requests || baseConfig.requests,
    options: {
      ...baseConfig.options,
      ...overrides.options,
    },
  };
}

import { TressiConfig } from 'tressi-common/config';

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
        payload: null,
        headers: null,
      },
    ],
    options: {
      durationSec: 5,
      rampUpTimeSec: 0,
      silent: true,
      headers: null,
      exportPath: null,
      threads: 4,
      workerMemoryLimit: 128,
      workerEarlyExit: {
        enabled: false,
        globalErrorRateThreshold: 0.1,
        globalErrorCountThreshold: 100,
        perEndpointThresholds: [],
        workerExitStatusCodes: [],
        monitoringWindowMs: 1000,
        stopMode: 'endpoint',
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
        payload: null,
        headers: null,
      },
    ],
    options: {
      durationSec: 1,
      rampUpTimeSec: 0,
      silent: true,
      headers: null,
      exportPath: null,
      threads: 4,
      workerMemoryLimit: 64,
      workerEarlyExit: {
        enabled: false,
        globalErrorRateThreshold: 0.1,
        globalErrorCountThreshold: 100,
        perEndpointThresholds: [],
        workerExitStatusCodes: [],
        monitoringWindowMs: 1000,
        stopMode: 'endpoint',
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

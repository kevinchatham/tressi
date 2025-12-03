import pkg from '../../../../package.json';
/**
 * Default Tressi configuration with sample requests.
 * This configuration provides a starting point for new users.
 */
export const defaultTressiConfig = {
  $schema: `https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v${pkg.version}.json`,
  options: {
    durationSec: 10,
    rampUpTimeSec: 0,
    threads: 4,
    silent: false,
    exportPath: './tressi-report',
    headers: {
      'User-Agent': 'Tressi/1.0.0',
    },
    workerMemoryLimit: 128,
    workerEarlyExit: {
      enabled: true,
      globalErrorRateThreshold: 0.1,
      globalErrorCountThreshold: 100,
      perEndpointThresholds: [],
      workerExitStatusCodes: [500, 502, 503, 504],
      monitoringWindowMs: 5000,
      stopMode: 'global' as const,
    },
  },
  requests: [
    {
      url: 'https://postman-echo.com/get',
      method: 'GET' as const,
      rps: 1,
      payload: null,
      headers: null,
    },
    {
      url: 'https://postman-echo.com/post',
      method: 'POST' as const,
      rps: 1,
      payload: { test: 'data' },
      headers: null,
    },
  ],
};

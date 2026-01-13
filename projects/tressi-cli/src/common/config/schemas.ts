import z from 'zod';

import pkg from '../../../../../package.json';

export const schemaDefault = `https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v${pkg.version}.json`;

export const headerDefaults = { 'User-Agent': 'Tressi' };

/**
 * Available HTTP methods for Tressi requests
 */
export const httpMethodDefaults = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

export const earlyExitDefaults = {
  enabled: false,
  errorRateThreshold: 0,
  exitStatusCodes: [],
  monitoringWindowMs: 1000,
};

export const requestDefaults = {
  url: '',
  payload: {},
  method: 'GET' as const,
  headers: headerDefaults,
  rps: 1,
  earlyExit: earlyExitDefaults,
};

export const optionsDefaults = {
  durationSec: 10,
  exportPath: '',
  silent: false,
  headers: headerDefaults,
  threads: 1,
  workerMemoryLimit: 128,
  workerEarlyExit: earlyExitDefaults,
};

/**
 * Zod schema for early exit configuration.
 */
export const EarlyExitConfigSchema = z
  .object({
    enabled: z.boolean().describe('Enable early exit for this endpoint'),
    errorRateThreshold: z
      .number()
      .min(0)
      .max(1)
      .describe('Error rate threshold (0.0-1.0)'),
    exitStatusCodes: z
      .array(z.number().int().positive())
      .describe('HTTP status codes that trigger immediate endpoint stop'),
    monitoringWindowMs: z
      .number()
      .int()
      .positive()
      .describe('Time window in milliseconds for threshold calculation'),
  })
  .default(earlyExitDefaults);

/**
 * Zod schema for a single request configuration.
 */
export const TressiRequestConfigSchema = z
  .object({
    url: z.url().describe('The URL to send the request to.'),
    payload: z
      .record(z.string(), z.unknown())
      .or(z.array(z.unknown()))
      .describe('The request payload. Can be a JSON object or an array.'),
    method: z
      .enum(httpMethodDefaults)
      .describe('The HTTP method to use for the request. Defaults to GET.'),
    headers: z
      .record(z.string(), z.string())
      .describe(
        'Headers to be sent with this specific request. Merged with global headers.',
      ),
    rps: z
      .number()
      .int()
      .min(1)
      .describe('Per-endpoint requests per second limit. Defaults to 1.'),
    earlyExit: EarlyExitConfigSchema.describe(
      'Optional early exit configuration for this specific endpoint',
    ),
  })
  .default(requestDefaults);

/**
 * Zod schema for Tressi options configuration.
 */
export const TressiOptionsConfigSchema = z
  .object({
    durationSec: z
      .number()
      .int()
      .positive()
      .describe('The total duration of the test in seconds. Defaults to 10.'),
    exportPath: z
      .string()
      .describe(
        'The base path for the exported report. If not provided, no report will be generated.',
      ),
    silent: z
      .boolean()
      .describe('Suppress all console output. Defaults to false.'),
    headers: z
      .record(z.string(), z.string())
      .describe('Global headers to be sent with every request.'),
    threads: z
      .number()
      .int()
      .min(1)
      .describe('Number of worker threads to use (defaults to CPU count)'),
    workerMemoryLimit: z
      .number()
      .int()
      .min(16)
      .max(512)
      .describe('Memory limit per worker in MB'),
    workerEarlyExit: EarlyExitConfigSchema.describe(
      'Global early exit configuration (acts as default for endpoints without specific config)',
    ),
  })
  .refine(
    (data) => {
      // Validate worker early exit configuration
      if (data.workerEarlyExit.enabled) {
        const hasThreshold = !!(
          data.workerEarlyExit.errorRateThreshold ||
          data.workerEarlyExit.exitStatusCodes.length > 0
        );
        return hasThreshold;
      }
      return true;
    },
    {
      message:
        'At least one threshold must be provided when workerEarlyExit is enabled',
      path: ['workerEarlyExit'],
    },
  )
  .default(optionsDefaults);

/**
 * Zod schema for the main Tressi configuration.
 */
export const TressiConfigSchema = z
  .object({
    $schema: z
      .string()
      .describe('A URL to the JSON schema for this configuration file.'),
    requests: z
      .array(TressiRequestConfigSchema)
      .min(1, 'At least one valid request is required')
      .describe('An array of request configurations.'),
    options: TressiOptionsConfigSchema.describe(
      'Configuration options for the test runner.',
    ),
  })
  .default({
    $schema: schemaDefault,
    requests: [],
    options: optionsDefaults,
  });

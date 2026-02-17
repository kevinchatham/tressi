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
  rampUpDurationSec: 0,
  earlyExit: earlyExitDefaults,
};

export const optionsDefaults = {
  durationSec: 10,
  rampUpDurationSec: 0,
  headers: headerDefaults,
  threads: 4,
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
    rampUpDurationSec: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Per-endpoint ramp-up time in seconds. If 0, uses global rampUpDurationSec. Defaults to 0.',
      ),
    earlyExit: EarlyExitConfigSchema.describe(
      'Optional early exit configuration for this specific endpoint',
    ),
  })
  .refine(
    (data) => {
      // If rampUpDurationSec is greater than zero, rps must be greater than or equal to 5
      if (data.rampUpDurationSec > 0 && data.rps < 5) {
        return false;
      }
      return true;
    },
    {
      message:
        'rps must be greater than or equal to 5 when rampUpDurationSec is greater than 0',
      path: ['rps'],
    },
  )
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
      .min(10)
      .default(10)
      .describe('The total duration of the test in seconds. Defaults to 10.'),
    rampUpDurationSec: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'The time in seconds to ramp up to the target RPS. Defaults to 0.',
      ),
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
  .refine(
    (data) => {
      // Validate that global rampUpDurationSec is not more than a quarter of durationSec
      if (data.options.rampUpDurationSec > data.options.durationSec / 4) {
        return false;
      }

      // Validate that each endpoint's rampUpDurationSec is not more than a quarter of durationSec
      return data.requests.every(
        (request) => request.rampUpDurationSec <= data.options.durationSec / 4,
      );
    },
    {
      message: 'rampUpDurationSec cannot exceed a quarter of durationSec',
      path: ['rampUpDurationSec'],
    },
  )
  .refine(
    (data) => {
      // Validate worker early exit configuration
      if (data.options.workerEarlyExit.enabled) {
        const hasThreshold = !!(
          data.options.workerEarlyExit.errorRateThreshold ||
          data.options.workerEarlyExit.exitStatusCodes.length > 0
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
  .refine(
    (data) => {
      // If global rampUpDurationSec is greater than zero, all endpoints must have rps > 5
      if (data.options.rampUpDurationSec > 0) {
        return data.requests.every((request) => request.rps >= 5);
      }
      return true;
    },
    {
      message:
        'All endpoints must have rps greater than or equal to 5 when global rampUpDurationSec is greater than 0',
      path: ['options', 'rampUpDurationSec'],
    },
  )
  .refine(
    (data) => {
      // If global or endpoint ramp up duration is greater than 0, the test must be at least 60 seconds long
      const hasGlobalRampUp = data.options.rampUpDurationSec > 0;
      const hasEndpointRampUp = data.requests.some(
        (request) => request.rampUpDurationSec > 0,
      );

      if (
        (hasGlobalRampUp || hasEndpointRampUp) &&
        data.options.durationSec < 60
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'durationSec must be at least 60 seconds when rampUpDurationSec is greater than 0',
      path: ['options', 'durationSec'],
    },
  )
  .default({
    $schema: schemaDefault,
    requests: [],
    options: optionsDefaults,
  });

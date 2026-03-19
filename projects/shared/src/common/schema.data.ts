/** biome-ignore-all lint/nursery/useExplicitType: zod */
import z from 'zod';

import pkg from '../../../../package.json';
import type { TressiConfig, TressiRequestConfig } from './config.types';

export const schemaDefault = `https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v${pkg.version}.json`;

export const headerDefaults = { 'User-Agent': 'Tressi' };

/**
 * Available HTTP methods for Tressi requests
 */
export const httpMethodDefaults = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export const earlyExitDefaults = {
  enabled: false,
  errorRateThreshold: 0,
  exitStatusCodes: [],
  monitoringWindowMs: 1000,
};

export const requestDefaults = {
  earlyExit: earlyExitDefaults,
  headers: headerDefaults,
  method: 'GET' as const,
  payload: {},
  rampUpDurationSec: 0,
  rps: 1,
  url: '',
};

export const optionsDefaults = {
  durationSec: 10,
  headers: headerDefaults,
  rampUpDurationSec: 0,
  threads: 4,
  workerEarlyExit: earlyExitDefaults,
  workerMemoryLimit: 128,
};

/**
 * Zod schema for early exit configuration.
 */
export const EarlyExitConfigSchema = z
  .object({
    enabled: z.boolean().describe('Enable early exit for this endpoint'),
    errorRateThreshold: z.number().min(0).max(1).describe('Error rate threshold (0.0-1.0)'),
    exitStatusCodes: z
      .array(z.number().int().positive())
      .describe('HTTP status codes that trigger immediate endpoint stop'),
    monitoringWindowMs: z
      .number()
      .int()
      .positive()
      .min(1000)
      .describe('Time window in milliseconds for threshold calculation'),
  })
  .default(earlyExitDefaults);

/**
 * Zod schema for a single request configuration.
 */
export const TressiRequestConfigSchema = z
  .object({
    earlyExit: EarlyExitConfigSchema.describe(
      'Optional early exit configuration for this specific endpoint',
    ),
    headers: z
      .record(z.string(), z.string())
      .describe('Headers to be sent with this specific request. Merged with global headers.'),
    method: z
      .enum(httpMethodDefaults)
      .describe('The HTTP method to use for the request. Defaults to GET.'),
    payload: z
      .record(z.string(), z.unknown())
      .or(z.array(z.unknown()))
      .describe('The request payload. Can be a JSON object or an array.'),
    rampUpDurationSec: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Per-endpoint ramp up time in seconds. If 0, uses global rampUpDurationSec. Defaults to 0.',
      ),
    rps: z.number().int().min(1).describe('Per-endpoint requests per second limit. Defaults to 1.'),
    url: z.url().describe('The URL to send the request to.'),
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
      .min(10)
      .default(10)
      .describe('The total duration of the test in seconds. Defaults to 10.'),
    headers: z
      .record(z.string(), z.string())
      .describe('Global headers to be sent with every request.'),
    rampUpDurationSec: z
      .number()
      .int()
      .nonnegative()
      .describe('The time in seconds to ramp up to the target RPS. Defaults to 0.'),
    threads: z
      .number()
      .int()
      .min(1)
      .describe('Number of worker threads to use (defaults to CPU count)'),
    workerEarlyExit: EarlyExitConfigSchema.describe(
      'Global early exit configuration (acts as default for endpoints without specific config)',
    ),
    workerMemoryLimit: z.number().int().min(16).max(512).describe('Memory limit per worker in MB'),
  })
  .refine(
    (data) => {
      // Validate worker early exit configuration
      if (data.workerEarlyExit.enabled) {
        const hasThreshold = !!(
          data.workerEarlyExit.errorRateThreshold || data.workerEarlyExit.exitStatusCodes.length > 0
        );
        return hasThreshold;
      }
      return true;
    },
    {
      message: 'At least one exit code must be provided when Early Exit is enabled',
      path: ['workerEarlyExit'],
    },
  )
  .default(optionsDefaults);

/**
 * Zod schema for the main Tressi configuration.
 */
export const TressiConfigSchema = z
  .object({
    $schema: z.string().describe('A URL to the JSON schema for this configuration file.'),
    options: TressiOptionsConfigSchema.describe('Configuration options for the test runner.'),
    requests: z
      .array(TressiRequestConfigSchema)
      .min(1, 'At least one valid request is required')
      .describe('An array of request configurations.'),
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
      message: 'Ramp Up Duration cannot exceed a quarter of the total test duration',
      path: ['rampUpDurationSec'],
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
        'All requests must have a target greater than or equal to 5 when Global Ramp Up Duration is greater than 0',
      path: ['options', 'rampUpDurationSec'],
    },
  )
  .refine(
    (data) => {
      if (data.requests.length > 1) {
        const urls = data.requests.map((req) => req.url);
        const uniqueUrls = new Set(urls);
        return uniqueUrls.size === urls.length;
      }
      return true;
    },
    {
      message: 'Duplicate endpoint URLs are not allowed',
      path: ['requests'],
    },
  )
  .default({
    $schema: schemaDefault,
    options: optionsDefaults,
    requests: [],
  });

/**
 * Default Tressi configuration with sample requests.
 * This configuration provides a starting point for new users.
 */
export const defaultTressiConfig: TressiConfig = ((): TressiConfig =>
  structuredClone(TressiConfigSchema.parse(undefined)))();

export const defaultTressiRequestConfig: TressiRequestConfig = ((): TressiRequestConfig =>
  structuredClone(TressiRequestConfigSchema.parse(undefined)))();

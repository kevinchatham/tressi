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
  errorRateThreshold: 1,
  exitStatusCodes: [500],
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
  threads: 2,
  workerEarlyExit: earlyExitDefaults,
  workerMemoryLimit: 128,
};

/**
 * Zod schema for early exit configuration.
 */
export const EarlyExitConfigSchema = z
  .object({
    enabled: z.boolean().describe('Enable early exit for this endpoint'),
    errorRateThreshold: z.number().min(1).max(100).describe('Error rate threshold (1-100)'),
    exitStatusCodes: z
      .array(z.number().int().min(100).max(599))
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
  .default(requestDefaults)
  .check((ctx) => {
    const data = ctx.value;
    if (data.earlyExit.enabled) {
      const hasThreshold =
        data.earlyExit.errorRateThreshold > 0 && data.earlyExit.exitStatusCodes.length > 0;
      if (!hasThreshold) {
        ctx.issues.push({
          code: 'custom',
          input: ctx.value,
          message: `Early Exit for ${ctx.value.url}: An error rate threshold and at least one exit status code must be provided when enabled`,
          path: ['earlyExit'],
        });
      }
    }
  });

/**
 * Zod schema for Tressi options configuration.
 */
export const TressiOptionsConfigSchema = z
  .object({
    durationSec: z
      .number()
      .int()
      .min(10)
      .default(10)
      .describe('The total duration of the test in seconds. Defaults to 10.'),
    headers: z
      .record(z.string(), z.string())
      .describe('Global headers to be sent with every request.'),
    rampUpDurationSec: z
      .number()
      .int()
      .min(0)
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
  .check((ctx) => {
    // Validate worker early exit configuration
    if (ctx.value.workerEarlyExit.enabled) {
      const hasThreshold =
        ctx.value.workerEarlyExit.errorRateThreshold > 0 &&
        ctx.value.workerEarlyExit.exitStatusCodes.length > 0;
      if (!hasThreshold) {
        ctx.issues.push({
          code: 'custom',
          input: ctx.value,
          message:
            'An error rate threshold and at least one exit status code must be provided when enabled',
          path: ['workerEarlyExit'],
        });
      }
    }
  })
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
  .check((ctx) => {
    if (ctx.value.options.rampUpDurationSec > ctx.value.options.durationSec / 2) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value,
        message: 'Duration cannot exceed half of the test duration',
        path: ['options', 'rampUpDurationSec'],
      });
    }

    ctx.value.requests.forEach((request, index) => {
      if (request.rampUpDurationSec > ctx.value.options.durationSec / 2) {
        ctx.issues.push({
          code: 'custom',
          input: ctx.value,
          message: 'Duration cannot exceed half of the test duration',
          path: ['requests', index, 'rampUpDurationSec'],
        });
      }
    });

    // If global or any per-request ramp up is enabled, all requests must have RPS >= 5
    const hasAnyRampUp =
      ctx.value.options.rampUpDurationSec > 0 ||
      ctx.value.requests.some((r) => r.rampUpDurationSec > 0);
    if (hasAnyRampUp) {
      const allRpsValid = ctx.value.requests.every((request) => request.rps >= 5);
      if (!allRpsValid) {
        ctx.issues.push({
          code: 'custom',
          input: ctx.value,
          message:
            'All requests must have a target greater than or equal to 5 when Ramp Up Duration is greater than 0',
          path: ['options', 'rampUpDurationSec'],
        });
      }
    }

    if (ctx.value.requests.length > 1) {
      const urls = ctx.value.requests.map((req) => req.url);
      const uniqueUrls = new Set(urls);
      if (uniqueUrls.size !== urls.length) {
        ctx.issues.push({
          code: 'custom',
          input: ctx.value,
          message: 'Requests: Duplicate URLs are not allowed',
          path: ['requests'],
        });
      }
    }
  })
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

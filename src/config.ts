import { promises as fs } from 'fs';
import path from 'path';
import { request } from 'undici';
import { z, ZodError } from 'zod';

import type { TressiConfig } from './types';

/**
 * Zod schema for a single request configuration.
 */
export const TressiRequestConfigSchema = z.object({
  /** The URL to send the request to. */
  url: z.string().url(),
  /** The request payload. Can be a JSON object or an array. */
  payload: z
    .record(z.string(), z.unknown())
    .or(z.array(z.unknown()))
    .optional(),
  /** The HTTP method to use for the request. Defaults to GET. */
  method: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    )
    .default('GET'),
  /** Headers to be sent with this specific request. Merged with global headers. */
  headers: z.record(z.string(), z.string()).optional(),
  /** Per-endpoint requests per second limit. Defaults to 1. */
  rps: z.number().int().min(1).default(1),
});

export const TressiOptionsConfigSchema = z
  .object({
    /** The total duration of the test in seconds. Defaults to 10. */
    durationSec: z.number().int().positive().default(10),
    /** The time in seconds to ramp up to the target RPS. Defaults to 0. */
    rampUpTimeSec: z.number().int().nonnegative().default(0),
    /** The base path for the exported report. If not provided, no report will be generated. */
    exportPath: z.union([z.string(), z.boolean()]).optional(),
    /** Whether to use the terminal UI. Defaults to true. */
    useUI: z.boolean().default(true),
    /** Suppress all console output. Defaults to false. */
    silent: z.boolean().default(false),
    /** Whether to enable early exit on error conditions. Defaults to false. */
    earlyExitOnError: z.boolean().default(false),
    /** Error rate threshold (0.0-1.0) to trigger early exit. Requires earlyExitOnError=true. */
    errorRateThreshold: z.number().min(0).max(1).optional(),
    /** Absolute error count threshold to trigger early exit. Requires earlyExitOnError=true. */
    errorCountThreshold: z.number().int().positive().optional(),
    /** Specific HTTP status codes that should trigger early exit. Requires earlyExitOnError=true. */
    errorStatusCodes: z.array(z.number().int().positive()).optional(),
    /** Global headers to be sent with every request. */
    headers: z.record(z.string(), z.string()).optional(),
    /** Adaptive concurrency configuration */
    adaptiveConcurrency: z
      .object({
        /** Maximum concurrent operations. Defaults to 10. */
        maxConcurrency: z.number().int().positive().default(10),
        /** Target response latency in milliseconds for adaptation. Defaults to 100. */
        targetLatency: z.number().int().positive().default(100),
        /** Memory usage threshold (0.0-1.0) for scaling down. Defaults to 0.8. */
        memoryThreshold: z.number().min(0.1).max(0.95).default(0.8),
        /** Whether to enable adaptive concurrency. Defaults to true. */
        enabled: z.boolean().default(true),
        /** Minimum concurrent operations. Defaults to 1. */
        minConcurrency: z.number().int().positive().default(1),
      })
      .optional()
      .default({}),
  })
  .refine(
    (data) => {
      // If earlyExitOnError is enabled, at least one threshold must be provided
      if (data.earlyExitOnError) {
        return !!(
          data.errorRateThreshold ||
          data.errorCountThreshold ||
          data.errorStatusCodes
        );
      }
      return true;
    },
    {
      message:
        'At least one of errorRateThreshold, errorCountThreshold, or errorStatusCodes must be provided when earlyExitOnError is enabled',
      path: ['earlyExitOnError'],
    },
  )
  .refine(
    (data) => {
      // useUI and silent cannot both be true
      return !(data.useUI && data.silent);
    },
    {
      message:
        'useUI and silent options cannot both be true. The TUI requires output, but silent mode suppresses all output.',
      path: ['useUI', 'silent'],
    },
  );

export const defaultTressiOptions = TressiOptionsConfigSchema.parse({});

/**
 * Zod schema for the main Tressi configuration.
 */
export const TressiConfigSchema = z.object({
  /** A URL to the JSON schema for this configuration file. */
  $schema: z.string(),
  /** An array of request configurations. */
  requests: z.array(TressiRequestConfigSchema),
  /** Configuration options for the test runner. */
  options: TressiOptionsConfigSchema.default(defaultTressiOptions),
});

/**
 * Loads and validates a Tressi configuration from a file, URL, or direct object.
 * @param configInput The path to a local config file or a URL to a remote config.
 * @returns A promise that resolves to the validated Tressi configuration.
 */
export async function loadConfig(
  configInput: string | TressiConfig,
): Promise<TressiConfig> {
  if (typeof configInput === 'object') {
    const parsed = TressiConfigSchema.parse(configInput);
    return parsed;
  }

  let rawContent: unknown;
  if (configInput.startsWith('http://') || configInput.startsWith('https://')) {
    const { statusCode, body } = await request(configInput);
    if (statusCode >= 400) {
      throw new Error(`Remote config fetch failed: ${statusCode}`);
    }
    rawContent = await body.json();
  } else {
    const absolutePath = path.resolve(configInput);
    const fileContent = await fs.readFile(absolutePath, 'utf-8');
    rawContent = JSON.parse(fileContent);
  }

  try {
    const parsed = TressiConfigSchema.parse(rawContent);
    return parsed;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Validation failed:', (error as ZodError).errors);
    throw error; // or handle appropriately
  }
}

/**
 * Generates a minimal Tressi configuration with essential options only.
 * @returns A minimal Tressi configuration object.
 */
export function generateMinimalConfig(): TressiConfig {
  return {
    $schema:
      'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
    options: {
      durationSec: 10,
      rampUpTimeSec: 0,
      useUI: true,
      silent: false,
      earlyExitOnError: false,
      adaptiveConcurrency: {
        maxConcurrency: 10,
        targetLatency: 100,
        memoryThreshold: 0.8,
        enabled: true,
        minConcurrency: 1,
      },
    },
    requests: [
      {
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
        rps: 10,
      },
      {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        rps: 5,
        payload: {
          name: 'Tressi Post',
        },
      },
    ],
  };
}

/**
 * Generates a full Tressi configuration with all options populated.
 * @returns A full Tressi configuration object with all default options.
 */
export function generateFullConfig(): TressiConfig {
  return {
    $schema:
      'https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v0.0.13.json',
    options: TressiOptionsConfigSchema.parse({
      adaptiveConcurrency: {
        maxConcurrency: 10,
        targetLatency: 100,
        memoryThreshold: 0.8,
        enabled: true,
        minConcurrency: 1,
      },
    }),
    requests: [
      {
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
        rps: 10,
      },
      {
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        rps: 5,
        payload: {
          name: 'Tressi Post',
        },
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      },
    ],
  };
}

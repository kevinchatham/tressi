import z from 'zod';

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
    .nullable()
    .optional(),
  /** The HTTP method to use for the request. Defaults to GET. */
  method: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    )
    .default('GET'),
  /** Headers to be sent with this specific request. Merged with global headers. */
  headers: z.record(z.string(), z.string()).nullable().optional(),
  /** Per-endpoint requests per second limit. Defaults to 1. */
  rps: z.number().int().min(1).default(1),
});

/**
 * Zod schema for Tressi options configuration.
 */
export const TressiOptionsConfigSchema = z
  .object({
    /** The total duration of the test in seconds. Defaults to 10. */
    durationSec: z.number().int().positive().default(10),
    /** The time in seconds to ramp up to the target RPS. Defaults to 0. */
    rampUpTimeSec: z.number().int().nonnegative().optional(),
    /** The base path for the exported report. If not provided, no report will be generated. */
    exportPath: z.string().nullable().optional(),
    /** Suppress all console output. Defaults to false. */
    silent: z.boolean().optional(),
    /** Global headers to be sent with every request. */
    headers: z.record(z.string(), z.string()).nullable().optional(),
    threads: z
      .number()
      .int()
      .min(1)
      .max(32)
      .optional()
      .describe('Number of worker threads to use (defaults to CPU count)'),
    workerMemoryLimit: z
      .number()
      .int()
      .min(16)
      .max(512)
      .optional()
      .describe('Memory limit per worker in MB'),
    workerEarlyExit: z
      .object({
        /** Enable early exit coordination across all workers */
        enabled: z.boolean().optional(),
        /** Global error rate threshold (0.0-1.0) across all workers */
        globalErrorRateThreshold: z.number().min(0).max(1).optional(),
        /** Global error count threshold across all workers */
        globalErrorCountThreshold: z.number().int().positive().optional(),
        /** Per-endpoint error rate thresholds */
        perEndpointThresholds: z
          .array(
            z.object({
              url: z.string(),
              errorRateThreshold: z.number().min(0).max(1),
              errorCountThreshold: z.number().int().positive().optional(),
            }),
          )
          .optional(),
        /** Specific HTTP status codes that trigger immediate worker shutdown */
        workerExitStatusCodes: z.array(z.number().int().positive()).optional(),
        /** Time window in milliseconds for threshold calculation */
        monitoringWindowMs: z.number().int().positive().optional(),
        /** Whether to stop individual endpoints vs entire test */
        stopMode: z.enum(['endpoint', 'global']).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      // Validate worker early exit configuration
      if (data.workerEarlyExit?.enabled) {
        const hasGlobalThreshold = !!(
          data.workerEarlyExit.globalErrorRateThreshold ||
          data.workerEarlyExit.globalErrorCountThreshold ||
          data.workerEarlyExit.workerExitStatusCodes
        );
        const hasPerEndpoint = !!(
          data.workerEarlyExit.perEndpointThresholds &&
          data.workerEarlyExit.perEndpointThresholds.length > 0
        );
        return hasGlobalThreshold || hasPerEndpoint;
      }
      return true;
    },
    {
      message:
        'At least one threshold must be provided when workerEarlyExit is enabled',
      path: ['workerEarlyExit'],
    },
  );

/**
 * Zod schema for the main Tressi configuration.
 */
export const TressiConfigSchema = z.object({
  /** A URL to the JSON schema for this configuration file. */
  $schema: z.string(),
  /** An array of request configurations. */
  requests: z.array(TressiRequestConfigSchema),
  /** Configuration options for the test runner. */
  options: TressiOptionsConfigSchema,
});

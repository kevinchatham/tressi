import { promises as fs } from 'fs';
import path from 'path';
import { request } from 'undici';
import { z } from 'zod';

/**
 * Zod schema for a single request configuration.
 */
const RequestConfigSchema = z.object({
  /** The URL to send the request to. */
  url: z
    .string()
    .min(1, 'URL cannot be empty')
    .url('Invalid URL format')
    .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'URL must start with http:// or https://',
    }),
  /** The request payload. Can be a JSON object or an array. */
  payload: z
    .record(z.string(), z.unknown())
    .or(z.array(z.unknown()))
    .optional(),
  /** The HTTP method to use for the request. Defaults to GET. */
  method: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']),
    )
    .default('GET'),
  /** Headers to be sent with this specific request. Merged with global headers. */
  headers: z.record(z.string(), z.string()).optional(),
});

/**
 * Zod schema for the main Tressi configuration.
 */
export const TressiConfigSchema = z.object({
  /** A URL to the JSON schema for this configuration file. */
  $schema: z.string().optional(),
  /** Global headers to be sent with every request. */
  headers: z.record(z.string(), z.string()).optional(),
  /** An array of request configurations. */
  requests: z
    .array(RequestConfigSchema)
    .min(1, 'At least one request must be specified'),
  /** Number of concurrent workers, or max workers if autoscale is enabled */
  workers: z.number().int().positive().optional(),
  /** Maximum concurrent requests per worker */
  concurrentRequests: z.number().int().positive().optional(),
  /** Duration in seconds */
  duration: z.number().int().positive().optional(),
  /** Time in seconds to ramp up to the target RPS */
  rampUpTime: z.number().int().min(0).optional(),
  /** Target requests per second */
  rps: z.number().int().positive().optional(),
  /** Enable autoscaling of workers */
  autoscale: z.boolean().optional(),
  /** Export a comprehensive report to a directory */
  export: z.string().min(1, 'Export path cannot be empty').optional(),
  /** Enable early exit on error conditions */
  earlyExitOnError: z.boolean().optional(),
  /** Error rate threshold (0.0-1.0) to trigger early exit */
  errorRateThreshold: z.number().min(0).max(1).optional(),
  /** Absolute error count threshold to trigger early exit */
  errorCountThreshold: z.number().int().positive().optional(),
  /** Array of HTTP status codes that should trigger early exit */
  errorStatusCodes: z.array(z.number().int().min(100).max(599)).optional(),
});

/**
 * Type representing the Tressi configuration.
 */
export type TressiConfig = z.infer<typeof TressiConfigSchema>;

/**
 * Type representing a single request configuration.
 */
export type RequestConfig = z.infer<typeof RequestConfigSchema>;

/**
 * Loads and validates a Tressi configuration from a file, URL, or direct object.
 * @param configInput The path to a local config file, a URL to a remote config, or a config object.
 * @returns A promise that resolves to the validated Tressi configuration.
 */
export async function loadConfig(
  configInput: string | TressiConfig,
): Promise<TressiConfig> {
  if (typeof configInput === 'object') {
    return TressiConfigSchema.parse(configInput);
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
  return TressiConfigSchema.parse(rawContent);
}

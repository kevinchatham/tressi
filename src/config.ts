import { promises as fs } from 'fs';
import path from 'path';
import { request } from 'undici';
import { z } from 'zod';

/**
 * Zod schema for a single request configuration.
 */
const RequestConfigSchema = z.object({
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
  requests: z.array(RequestConfigSchema),
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

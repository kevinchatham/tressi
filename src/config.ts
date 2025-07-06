import jiti from 'jiti';
import path from 'path';
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
  /** The HTTP method to use for the request. */
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
});

/**
 * Zod schema for the main Tressi configuration.
 */
const TressiConfigSchema = z.object({
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
 * A helper function for defining a Tressi configuration with type-checking.
 * @param config The Tressi configuration object.
 * @returns The validated Tressi configuration object.
 */
export function defineConfig(config: TressiConfig): TressiConfig {
  return config;
}

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
    const res = await fetch(configInput);
    if (!res.ok) throw new Error(`Remote config fetch failed: ${res.status}`);
    rawContent = await res.json();
  } else {
    const absolutePath = path.resolve(configInput);
    const _jiti = jiti(__filename);
    const module = _jiti(absolutePath);
    rawContent = module.default || module;
  }
  return TressiConfigSchema.parse(rawContent);
}

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  type TressiConfig,
  TressiConfigSchema,
  TressiOptionsConfigSchema,
} from 'tressi-common';
import { request } from 'undici';
import { ZodError } from 'zod';

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
      workerMemoryLimit: 128,
      workerEarlyExit: {
        enabled: false,
        monitoringWindowMs: 1000,
        stopMode: 'endpoint',
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
      workerMemoryLimit: 128,
      workerEarlyExit: {
        enabled: false,
        monitoringWindowMs: 1000,
        stopMode: 'endpoint',
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

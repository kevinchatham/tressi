import { promises as fs } from 'fs';
import * as path from 'path';
import {
  defaultTressiConfig,
  SafeTressiConfig,
  type TressiConfig,
  TressiConfigSchema,
} from 'tressi-common/config';
import { request } from 'undici';

import {
  ConfigMergeError,
  ConfigValidationError,
  ConfigValidationResult,
} from '../types';

class TressiConfigLoader {
  /**
   * Loads and validates configuration from file, URL, or object
   */
  async load(
    potentialConfig?: string | TressiConfig,
  ): Promise<{ config: SafeTressiConfig; path: string }> {
    if (!potentialConfig)
      potentialConfig = path.resolve(process.cwd(), 'tressi.config.json');

    // Handle direct object input
    if (typeof potentialConfig === 'object') {
      const result = validateAndMergeConfig(potentialConfig);
      if (!result.success) {
        // Convert to error for backward compat at this boundary
        throw new Error(result.error.message);
      }
      return {
        config: result.data,
        path: '[object]',
      };
    }

    // Handle URL input
    if (this.isUrl(potentialConfig)) {
      const rawContent = await this.fetchRemoteConfig(potentialConfig);
      const result = validateAndMergeConfig(rawContent);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return {
        config: result.data,
        path: potentialConfig,
      };
    }

    // Handle file input
    const rawContent = await this.loadFileConfig(potentialConfig);
    const result = validateAndMergeConfig(rawContent);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    return {
      config: result.data,
      path: potentialConfig,
    };
  }

  private isUrl(input: string): boolean {
    return input.startsWith('http://') || input.startsWith('https://');
  }

  private async fetchRemoteConfig(url: string): Promise<unknown> {
    try {
      const { statusCode, body } = await request(url);
      if (statusCode >= 400) {
        throw new Error(`Remote config fetch failed with status ${statusCode}`);
      }
      return await body.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch failed')) {
        throw error;
      }
      throw new Error(
        `Failed to fetch remote configuration: ${error instanceof Error ? error.message : 'Network error'}`,
      );
    }
  }

  private async loadFileConfig(filePath: string): Promise<unknown> {
    const absolutePath = path.resolve(filePath);

    // Check if file exists and is readable
    try {
      await fs.access(absolutePath, fs.constants.R_OK);
    } catch {
      throw new Error(
        `Configuration file not found or not readable: ${absolutePath}`,
      );
    }

    const fileContent = await fs.readFile(absolutePath, 'utf-8');

    if (!fileContent.trim()) {
      throw new Error(`Configuration file is empty: ${absolutePath}`);
    }

    try {
      return JSON.parse(fileContent);
    } catch (parseError) {
      throw new Error(
        `Invalid JSON in configuration file ${absolutePath}: ${parseError instanceof Error ? parseError.message : 'JSON parsing failed'}`,
      );
    }
  }

  static validateAndMergeConfig(
    rawContent: unknown | TressiConfig,
  ): ConfigValidationResult {
    // Use Zod's safeParse to avoid exceptions
    const parseResult = TressiConfigSchema.safeParse(rawContent);

    if (!parseResult.success) {
      return {
        success: false,
        error: new ConfigValidationError(parseResult.error),
      };
    }

    // Merge with defaults - collect errors instead of throwing
    return TressiConfigLoader.mergeWithDefaultConfig(parseResult.data);
  }

  /**
   * Merges the input configuration with the default Tressi configuration.
   * This ensures all optional fields have default values populated.
   * @param config The input configuration to merge with defaults
   * @returns A complete TressiConfig with all values present
   * @throws Error if the configuration is invalid or missing required fields
   */
  static mergeWithDefaultConfig(config: TressiConfig): ConfigValidationResult {
    const mergeFailures: Array<{
      path: string;
      message: string;
      attemptedValue?: unknown;
    }> = [];

    // Validate structure
    if (!config.options || typeof config.options !== 'object') {
      mergeFailures.push({
        path: 'options',
        message: 'Must be a valid object',
        attemptedValue: config.options,
      });
    }

    if (!Array.isArray(config.requests)) {
      mergeFailures.push({
        path: 'requests',
        message: 'Must be a valid array',
        attemptedValue: config.requests,
      });
    } else if (config.requests.length === 0) {
      mergeFailures.push({
        path: 'requests',
        message: 'Must contain at least one request',
        attemptedValue: config.requests,
      });
    }

    // Validate each request and collect all errors
    const normalizedRequests = config.requests.map((request, i) => {
      const requestPath = `requests[${i}]`;
      const failures: typeof mergeFailures = [];

      if (!request.url || typeof request.url !== 'string') {
        failures.push({
          path: `${requestPath}.url`,
          message: 'Must be a valid URL string',
          attemptedValue: request.url,
        });
      }

      if (!request.method || typeof request.method !== 'string') {
        failures.push({
          path: `${requestPath}.method`,
          message: 'Must be a valid HTTP method',
          attemptedValue: request.method,
        });
      }

      if (typeof request.rps !== 'number' || request.rps < 1) {
        failures.push({
          path: `${requestPath}.rps`,
          message: 'Must be a number >= 1',
          attemptedValue: request.rps,
        });
      }

      mergeFailures.push(...failures);

      // Return normalized request - TypeScript infers the type correctly
      return {
        url: request.url || '',
        method: request.method || 'GET',
        rps: typeof request.rps === 'number' ? request.rps : 1,
        payload: request.payload === undefined ? null : request.payload,
        headers: request.headers === undefined ? null : request.headers,
      };
    });

    // Return error if any failures were found
    if (mergeFailures.length > 0) {
      return {
        success: false,
        error: new ConfigMergeError(
          `Configuration merge failed: ${mergeFailures.length} validation error(s)`,
          mergeFailures,
        ),
      };
    }

    // All validations passed - perform merge
    // TypeScript verifies this satisfies SafeTressiConfig without assertions
    const mergedOptions: SafeTressiConfig['options'] = {
      ...defaultTressiConfig.options,
      ...config.options,
    };

    // Handle workerEarlyExit nested object with proper typing
    if (
      config.options?.workerEarlyExit &&
      typeof config.options.workerEarlyExit === 'object'
    ) {
      mergedOptions.workerEarlyExit = {
        ...defaultTressiConfig.options.workerEarlyExit,
        ...config.options.workerEarlyExit,
      };
    }

    // Return fully typed SafeTressiConfig - no type assertion needed
    return {
      success: true,
      data: {
        $schema: config.$schema ?? defaultTressiConfig.$schema,
        requests: normalizedRequests,
        options: mergedOptions,
      },
    };
  }
}

const loader = new TressiConfigLoader();

export async function loadConfig(
  configInput?: string | TressiConfig,
): Promise<{ config: SafeTressiConfig; path: string }> {
  return await loader.load(configInput);
}

export const validateAndMergeConfig = TressiConfigLoader.validateAndMergeConfig;

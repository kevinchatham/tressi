import { ZodError } from 'zod';

import { TressiConfigSchema } from './schemas';
import { TressiConfig } from './types';

/**
 * Discriminated union result type for configuration validation
 * Success path contains fully typed TressiConfig
 * Failure path contains structured error information
 */
export type ConfigValidationResult =
  | {
      success: false;
      error: ZodError;
    }
  | {
      success: true;
      data: TressiConfig;
    };

export function validateConfig(rawContent: unknown): ConfigValidationResult {
  const parseResult = TressiConfigSchema.safeParse(rawContent);

  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
    };
  }

  return {
    success: true,
    data: parseResult.data,
  };
}

/**
 * Error class for configuration merging failures
 * Collects all merge errors before returning
 */
export class ConfigMergeError extends Error {
  constructor(
    message: string,
    public readonly mergeFailures: ReadonlyArray<{
      readonly path: string;
      readonly message: string;
      readonly attemptedValue?: unknown;
    }>,
  ) {
    super(message);
    this.name = 'ConfigMergeError';
  }
}

/**
 * Error response structure
 */
export type ErrorApiResponse = {
  error: {
    message: string;
    code?: string;
    details?: string[];
    timestamp: string;
    path?: string;
  };
};

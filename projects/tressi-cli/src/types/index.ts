import { SafeTressiConfig } from 'tressi-common/config';
import { ZodError } from 'zod';

/**
 * Discriminated union result type for configuration validation
 * Success path contains fully typed SafeTressiConfig
 * Failure path contains structured error information
 */
export type ConfigValidationResult =
  | { success: true; data: SafeTressiConfig }
  | { success: false; error: ConfigValidationError | ConfigMergeError };

/**
 * Error class for Zod validation failures
 * Preserves full ZodError structure for detailed error reporting
 */
export class ConfigValidationError extends Error {
  public readonly fieldErrors: ReadonlyArray<{
    readonly path: string;
    readonly message: string;
    readonly code: string;
    readonly received?: unknown;
    readonly expected?: unknown;
  }>;

  constructor(public readonly zodError: ZodError) {
    const fieldErrors = zodError.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: 'received' in err ? err.received : undefined,
      expected: 'expected' in err ? err.expected : undefined,
    }));

    super(`Configuration validation failed: ${fieldErrors.length} error(s)`);
    this.name = 'ConfigValidationError';
    this.fieldErrors = Object.freeze(fieldErrors);
  }
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

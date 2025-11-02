import { z, ZodError } from 'zod';

/**
 * Validation utility functions.
 */
export class ValidationUtils {
  /**
   * Validates data against a Zod schema and returns a detailed error message.
   * @param schema The Zod schema to validate against
   * @param data The data to validate
   * @returns Object with success status and either data or error message
   */
  static validateWithDetails<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
  ): { success: true; data: T } | { success: false; error: string } {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });
        return {
          success: false,
          error: `Validation failed:\n${errorMessages.join('\n')}`,
        };
      }
      return { success: false, error: `Validation failed: ${String(error)}` };
    }
  }

  /**
   * Validates that a value is a positive integer.
   * @param value The value to validate
   * @param fieldName Name of the field for error messages
   * @returns Validation result
   */
  static validatePositiveInteger(
    value: unknown,
    fieldName: string,
  ): { valid: boolean; error?: string } {
    if (!Number.isInteger(value) || (value as number) <= 0) {
      return { valid: false, error: `${fieldName} must be a positive integer` };
    }
    return { valid: true };
  }

  /**
   * Validates that a value is within a specified range.
   * @param value The value to validate
   * @param min Minimum allowed value
   * @param max Maximum allowed value
   * @param fieldName Name of the field for error messages
   * @returns Validation result
   */
  static validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
  ): { valid: boolean; error?: string } {
    if (value < min || value > max) {
      return {
        valid: false,
        error: `${fieldName} must be between ${min} and ${max}`,
      };
    }
    return { valid: true };
  }

  /**
   * Validates HTTP status codes.
   * @param codes Array of status codes to validate
   * @returns Validation result
   */
  static validateHttpStatusCodes(codes: unknown[]): {
    valid: boolean;
    error?: string;
  } {
    if (!Array.isArray(codes)) {
      return { valid: false, error: 'Status codes must be an array' };
    }

    for (const code of codes) {
      if (
        !Number.isInteger(code) ||
        (code as number) < 100 ||
        (code as number) > 599
      ) {
        return {
          valid: false,
          error: `Invalid HTTP status code: ${code}. Must be between 100-599`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validates a URL string.
   * @param url URL to validate
   * @returns Validation result
   */
  static validateUrl(url: string): { valid: boolean; error?: string } {
    try {
      new URL(url);
      return { valid: true };
    } catch {
      return { valid: false, error: `Invalid URL: ${url}` };
    }
  }

  /**
   * Validates that early exit configuration is complete.
   * @param earlyExitOnError Whether early exit is enabled
   * @param errorRateThreshold Error rate threshold
   * @param errorCountThreshold Error count threshold
   * @param errorStatusCodes Error status codes
   * @returns Validation result
   */
  static validateEarlyExitConfig(
    earlyExitOnError: boolean,
    errorRateThreshold?: number,
    errorCountThreshold?: number,
    errorStatusCodes?: number[],
  ): { valid: boolean; error?: string } {
    if (!earlyExitOnError) {
      return { valid: true };
    }

    if (
      errorRateThreshold === undefined &&
      errorCountThreshold === undefined &&
      errorStatusCodes === undefined
    ) {
      return {
        valid: false,
        error:
          'When earlyExitOnError is enabled, at least one of errorRateThreshold, errorCountThreshold, or errorStatusCodes must be provided',
      };
    }

    // Validate error rate threshold
    if (errorRateThreshold !== undefined) {
      const rangeValidation = this.validateRange(
        errorRateThreshold,
        0,
        1,
        'errorRateThreshold',
      );
      if (!rangeValidation.valid) {
        return rangeValidation;
      }
    }

    // Validate error count threshold
    if (errorCountThreshold !== undefined) {
      if (!Number.isInteger(errorCountThreshold) || errorCountThreshold < 0) {
        return {
          valid: false,
          error: 'errorCountThreshold must be a non-negative integer',
        };
      }
    }

    // Validate error status codes
    if (errorStatusCodes !== undefined) {
      const codesValidation = this.validateHttpStatusCodes(errorStatusCodes);
      if (!codesValidation.valid) {
        return codesValidation;
      }
    }

    return { valid: true };
  }
}

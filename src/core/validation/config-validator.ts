import type { TressiOptionsConfig } from '../../types';

/**
 * Validates Tressi configuration options with proper defaults and constraints.
 * This class handles validation of early exit options and other configuration parameters.
 */
export class ConfigValidator {
  /**
   * Validates early exit configuration options.
   * @param options The raw TressiOptionsConfig to validate
   * @returns Validated TressiOptionsConfig with defaults applied
   * @throws Error if validation fails
   */
  validateEarlyExitOptions(options: TressiOptionsConfig): TressiOptionsConfig {
    const validated: TressiOptionsConfig = { ...options };

    // Set defaults for early exit options
    validated.earlyExitOnError = options.earlyExitOnError ?? false;
    validated.errorRateThreshold = options.errorRateThreshold;
    validated.errorCountThreshold = options.errorCountThreshold;
    validated.errorStatusCodes = options.errorStatusCodes;

    // Validate constraints when early exit is enabled
    if (validated.earlyExitOnError) {
      // Validate error rate threshold (must be between 0.0 and 1.0)
      if (validated.errorRateThreshold !== undefined) {
        this.validateErrorRateThreshold(validated.errorRateThreshold);
      }

      // Validate error count threshold (must be positive integer)
      if (validated.errorCountThreshold !== undefined) {
        this.validateErrorCountThreshold(validated.errorCountThreshold);
      }

      // Validate error status codes (must be array of valid HTTP status codes)
      if (validated.errorStatusCodes !== undefined) {
        this.validateErrorStatusCodes(validated.errorStatusCodes);
      }

      // Ensure at least one threshold is provided when early exit is enabled
      this.validateEarlyExitThresholds(validated);
    }

    return validated;
  }

  /**
   * Validates the error rate threshold.
   * @param threshold The error rate threshold to validate
   * @throws Error if validation fails
   */
  private validateErrorRateThreshold(threshold: number): void {
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
      throw new Error(
        'errorRateThreshold must be a number between 0.0 and 1.0',
      );
    }
  }

  /**
   * Validates the error count threshold.
   * @param threshold The error count threshold to validate
   * @throws Error if validation fails
   */
  private validateErrorCountThreshold(threshold: number): void {
    if (!Number.isInteger(threshold) || threshold < 0) {
      throw new Error('errorCountThreshold must be a non-negative integer');
    }
  }

  /**
   * Validates the error status codes.
   * @param statusCodes The error status codes to validate
   * @throws Error if validation fails
   */
  private validateErrorStatusCodes(statusCodes: number[]): void {
    if (!Array.isArray(statusCodes)) {
      throw new Error('errorStatusCodes must be an array of numbers');
    }

    for (const code of statusCodes) {
      if (!Number.isInteger(code) || code < 100 || code > 599) {
        throw new Error(
          `Invalid HTTP status code: ${code}. Must be between 100-599`,
        );
      }
    }
  }

  /**
   * Validates that at least one threshold is provided when early exit is enabled.
   * @param options The validated options
   * @throws Error if validation fails
   */
  private validateEarlyExitThresholds(options: TressiOptionsConfig): void {
    if (
      options.errorRateThreshold === undefined &&
      options.errorCountThreshold === undefined &&
      options.errorStatusCodes === undefined
    ) {
      throw new Error(
        'When earlyExitOnError is enabled, at least one of errorRateThreshold, errorCountThreshold, or errorStatusCodes must be provided',
      );
    }
  }

  /**
   * Validates the complete configuration.
   * @param options The configuration options to validate
   * @returns Validated configuration with defaults applied
   * @throws Error if validation fails
   */
  validateConfig(options: TressiOptionsConfig): TressiOptionsConfig {
    return this.validateEarlyExitOptions(options);
  }

  /**
   * Validates worker configuration.
   * @param workers The number of workers
   * @throws Error if validation fails
   */
  validateWorkers(workers: number): void {
    if (!Number.isInteger(workers) || workers <= 0) {
      throw new Error('workers must be a positive integer');
    }
  }

  /**
   * Validates duration configuration.
   * @param durationSec The duration in seconds
   * @throws Error if validation fails
   */
  validateDuration(durationSec: number): void {
    if (!Number.isInteger(durationSec) || durationSec <= 0) {
      throw new Error('durationSec must be a positive integer');
    }
  }

  /**
   * Validates RPS configuration.
   * @param rps The requests per second
   * @throws Error if validation fails
   */
  validateRps(rps: number): void {
    if (!Number.isInteger(rps) || rps < 1) {
      throw new Error('rps must be a positive integer (minimum 1)');
    }
  }

  /**
   * Validates ramp-up time configuration.
   * @param rampUpTimeSec The ramp-up time in seconds
   * @throws Error if validation fails
   */
  validateRampUpTime(rampUpTimeSec: number): void {
    if (!Number.isInteger(rampUpTimeSec) || rampUpTimeSec < 0) {
      throw new Error('rampUpTimeSec must be a non-negative integer');
    }
  }

  /**
   * Validates a complete configuration object.
   * @param options The configuration to validate
   * @returns Validation result with any errors
   */
  validate(options: TressiOptionsConfig): ValidationResult {
    const errors: string[] = [];

    try {
      this.validateConfig(options);
    } catch (error) {
      errors.push((error as Error).message);
    }

    // Additional validations
    if (options.workers !== undefined) {
      try {
        this.validateWorkers(options.workers);
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    if (options.durationSec !== undefined) {
      try {
        this.validateDuration(options.durationSec);
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    if (options.rps !== undefined) {
      try {
        this.validateRps(options.rps);
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    if (options.rampUpTimeSec !== undefined) {
      try {
        this.validateRampUpTime(options.rampUpTimeSec);
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      validatedOptions:
        errors.length === 0 ? this.validateConfig(options) : undefined,
    };
  }
}

/**
 * Result of configuration validation
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  isValid: boolean;
  /** Array of validation errors (empty if valid) */
  errors: string[];
  /** Validated configuration options (undefined if invalid) */
  validatedOptions?: TressiOptionsConfig;
}

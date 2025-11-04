import { defaultTressiOptions, TressiConfigSchema } from '../../config';
import type {
  SafeTressiConfig,
  TressiConfig,
  TressiOptionsConfig,
} from '../../types';
import { ValidationUtils } from '../../utils/validation-utils';

/**
 * Validates Tressi configuration with detailed error reporting.
 */
export class ConfigValidator {
  private static readonly SCHEMA = TressiConfigSchema;

  /**
   * Validates a complete Tressi configuration.
   * @param config Configuration to validate
   * @returns Validation result with detailed error messages
   */
  static validate(config: unknown): {
    valid: boolean;
    errors: string[];
    config?: SafeTressiConfig;
  } {
    const errors: string[] = [];

    // First, validate against the Zod schema
    const schemaValidation = ValidationUtils.validateWithDetails(
      this.SCHEMA,
      config,
    );
    if (!schemaValidation.success) {
      errors.push(schemaValidation.error);
      return { valid: false, errors };
    }

    const parsedConfig = schemaValidation.data as TressiConfig;

    // Validate individual components
    const optionsErrors = this.validateOptions(
      parsedConfig.options || defaultTressiOptions,
    );
    const requestsErrors = this.validateRequests(parsedConfig.requests);

    errors.push(...optionsErrors, ...requestsErrors);

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Return properly typed config
    const safeConfig: SafeTressiConfig = {
      $schema: parsedConfig.$schema,
      requests: parsedConfig.requests,
      options: parsedConfig.options || defaultTressiOptions,
    };

    return { valid: true, errors: [], config: safeConfig };
  }

  /**
   * Validates Tressi options configuration.
   * @param options Options to validate
   * @returns Array of validation errors
   */
  private static validateOptions(options: TressiOptionsConfig): string[] {
    const errors: string[] = [];

    // Validate early exit configuration
    const earlyExitValidation = ValidationUtils.validateEarlyExitConfig(
      options.earlyExitOnError,
      options.errorRateThreshold,
      options.errorCountThreshold,
      options.errorStatusCodes,
    );

    if (!earlyExitValidation.valid && earlyExitValidation.error) {
      errors.push(earlyExitValidation.error);
    }

    // Validate individual numeric options
    const numericValidations = [
      { value: options.workers, field: 'workers', min: 1 },
      { value: options.durationSec, field: 'durationSec', min: 1 },
      { value: options.rampUpTimeSec, field: 'rampUpTimeSec', min: 0 },
      { value: options.rps, field: 'rps', min: 0.01 },
    ];

    for (const validation of numericValidations) {
      if (validation.value !== undefined && validation.value < validation.min) {
        errors.push(`${validation.field} must be at least ${validation.min}`);
      }
    }

    return errors;
  }

  /**
   * Validates Tressi request configurations.
   * @param requests Array of requests to validate
   * @returns Array of validation errors
   */
  private static validateRequests(
    requests: TressiConfig['requests'],
  ): string[] {
    const errors: string[] = [];

    if (!Array.isArray(requests) || requests.length === 0) {
      errors.push('At least one request must be specified');
      return errors;
    }

    requests.forEach((request, index) => {
      // Validate URL
      if (request.url) {
        const urlValidation = ValidationUtils.validateUrl(request.url);
        if (!urlValidation.valid && urlValidation.error) {
          errors.push(`Request ${index + 1}: ${urlValidation.error}`);
        }
      }

      // Validate method (should already be handled by Zod, but double-check)
      if (request.method) {
        const validMethods = [
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'HEAD',
          'OPTIONS',
        ];
        if (!validMethods.includes(request.method.toUpperCase())) {
          errors.push(
            `Request ${index + 1}: Invalid HTTP method ${request.method}`,
          );
        }
      }
    });

    return errors;
  }

  /**
   * Validates a configuration file path.
   * @param configPath Path to the configuration file
   * @returns Validation result
   */
  static validateConfigPath(configPath: string): {
    valid: boolean;
    error?: string;
  } {
    if (!configPath) {
      return { valid: false, error: 'Configuration path is required' };
    }

    // Check if it's a URL
    if (configPath.startsWith('http://') || configPath.startsWith('https://')) {
      const urlValidation = ValidationUtils.validateUrl(configPath);
      if (!urlValidation.valid) {
        return { valid: false, error: urlValidation.error };
      }
      return { valid: true };
    }

    // For local files, basic path validation
    if (configPath.includes('..')) {
      return {
        valid: false,
        error:
          'Configuration path cannot contain directory traversal sequences',
      };
    }

    return { valid: true };
  }

  /**
   * Gets validation hints for common configuration issues.
   * @param config Partial configuration object
   * @returns Array of helpful hints
   */
  static getValidationHints(config: Partial<TressiConfig>): string[] {
    const hints: string[] = [];

    if (!config.options) {
      hints.push(
        'Consider adding an options section to customize test behavior',
      );
    }

    if (config.requests && config.requests.length === 0) {
      hints.push('Add at least one request to define what endpoints to test');
    }

    if (
      config.options?.earlyExitOnError &&
      !config.options.errorRateThreshold &&
      !config.options.errorCountThreshold &&
      !config.options.errorStatusCodes
    ) {
      hints.push(
        'When earlyExitOnError is enabled, specify at least one threshold condition',
      );
    }

    if (config.options?.rps && config.options.rps > 1000) {
      hints.push(
        'High RPS values (>1000) may require more workers or system tuning',
      );
    }

    if (config.options?.durationSec && config.options.durationSec > 300) {
      hints.push(
        'Long test durations (>5 minutes) may generate large result sets',
      );
    }

    return hints;
  }
}

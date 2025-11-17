import type { TressiConfig, TressiRequestConfig } from 'tressi-common';

export interface RateLimitValidationResult {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
  errors: string[];
}

export class RateLimitValidator {
  private static readonly MAX_RPS_PER_ENDPOINT = 50;
  private static readonly MAX_TOTAL_RPS = 500;

  /**
   * Validates rate limiting configuration
   * @param config The configuration to validate
   * @returns Validation result with warnings, recommendations, and errors
   */
  static validate(config: TressiConfig): RateLimitValidationResult {
    const result: RateLimitValidationResult = {
      isValid: true,
      warnings: [],
      recommendations: [],
      errors: [],
    };

    // Validate individual requests
    for (const request of config.requests) {
      this.validateRequest(request, result);
    }

    // Validate overall configuration
    this.validateOverallConfig(config, result);

    // Set isValid based on errors
    result.isValid = result.errors.length === 0;

    return result;
  }

  /**
   * Validates a single request configuration
   * @param request The request to validate
   * @param result The validation result to update
   */
  private static validateRequest(
    request: TressiRequestConfig,
    result: RateLimitValidationResult,
  ): void {
    // Validate RPS range
    if (request.rps <= 0) {
      result.errors.push(
        `Invalid RPS (${request.rps}) for endpoint: ${request.url}. Must be greater than 0.`,
      );
    } else if (request.rps > this.MAX_RPS_PER_ENDPOINT) {
      result.warnings.push(
        `High RPS (${request.rps}) for endpoint: ${request.url}. Consider reducing to ${this.MAX_RPS_PER_ENDPOINT} or less for better control.`,
      );
    }
  }

  /**
   * Validates the overall configuration
   * @param config The configuration to validate
   * @param result The validation result to update
   */
  private static validateOverallConfig(
    config: TressiConfig,
    result: RateLimitValidationResult,
  ): void {
    const totalRps = config.requests.reduce(
      (sum, req) => sum + (req.rps || 0),
      0,
    );

    // Validate total RPS
    if (totalRps > this.MAX_TOTAL_RPS) {
      result.warnings.push(
        `High total RPS (${totalRps}). Consider reducing individual endpoint RPS or using fewer endpoints.`,
      );
    }
  }

  /**
   * Logs validation results to console
   * @param result The validation result
   */
  static logValidationResults(result: RateLimitValidationResult): void {
    if (result.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('❌ Rate Limit Configuration Errors:');
      result.errors.forEach((error) => {
        // eslint-disable-next-line no-console
        console.error(`  ${error}`);
      });
    }

    if (result.warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('⚠️  Rate Limit Configuration Warnings:');
      result.warnings.forEach((warning) => {
        // eslint-disable-next-line no-console
        console.warn(`  ${warning}`);
      });
    }

    if (result.recommendations.length > 0) {
      // eslint-disable-next-line no-console
      console.info('💡 Configuration Recommendations:');
      result.recommendations.forEach((rec) => {
        // eslint-disable-next-line no-console
        console.info(`  ${rec}`);
      });
    }

    if (
      result.isValid &&
      result.errors.length === 0 &&
      result.warnings.length === 0
    ) {
      // eslint-disable-next-line no-console
      console.info('✅ Rate limit configuration is valid');
    }
  }
}

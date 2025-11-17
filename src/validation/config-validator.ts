import chalk from 'chalk';
import { z, ZodError } from 'zod';

import { TressiConfigSchema } from '../core/config';
import type { TressiConfig } from '../types';

/**
 * Custom validation error for programmatic usage
 */
export class ValidationError extends Error {
  public readonly type = 'CONFIG_VALIDATION';
  public readonly details: z.ZodIssue[];
  public readonly fieldErrors: Record<string, string[]>;

  constructor(error: ZodError) {
    super('Configuration validation failed');
    this.name = 'ValidationError';
    this.details = error.errors;
    this.fieldErrors = this.groupErrorsByField(error.errors);
  }

  private groupErrorsByField(errors: z.ZodIssue[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const error of errors) {
      const path = error.path.join('.');
      if (!grouped[path]) {
        grouped[path] = [];
      }
      grouped[path].push(error.message);
    }

    return grouped;
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      fieldErrors: this.fieldErrors,
    };
  }
}

/**
 * Unified configuration validator that handles both CLI and programmatic usage
 */
export class ConfigValidator {
  /**
   * Validates configuration for CLI usage with user-friendly error messages
   * @param config Configuration to validate
   * @returns Validated configuration or exits process on error
   */
  static validateForCLI(config: unknown): TressiConfig {
    try {
      return TressiConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof ZodError) {
        this.handleCLIError(error);
      }
      throw error;
    }
  }

  /**
   * Validates configuration for programmatic usage with structured errors
   * @param config Configuration to validate
   * @returns Validated configuration
   * @throws ValidationError with detailed error information
   */
  static validateForProgrammatic(config: unknown): TressiConfig {
    try {
      return TressiConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(error);
      }
      throw error;
    }
  }

  /**
   * Validates configuration and returns result object instead of throwing
   * @param config Configuration to validate
   * @returns Validation result with success status and errors
   */
  static validateWithResult(config: unknown):
    | {
        success: true;
        data: TressiConfig;
      }
    | {
        success: false;
        error: ValidationError;
      } {
    try {
      const data = this.validateForProgrammatic(config);
      return { success: true, data };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error };
      }
      throw error;
    }
  }

  /**
   * Handles CLI validation errors with user-friendly formatting
   * @param error Zod validation error
   */
  private static handleCLIError(error: ZodError): never {
    const formatted = this.formatCLIError(error);
    // eslint-disable-next-line no-console
    console.error(formatted);
    process.exit(1);
  }

  /**
   * Formats Zod errors for CLI display with colors and hints
   * @param error Zod validation error
   * @returns Formatted error string
   */
  private static formatCLIError(error: ZodError): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.red('❌ Configuration Error'));
    lines.push('');

    // Group errors by path
    const grouped = this.groupErrorsByPath(error.errors);

    // Format each error
    for (const [path, errors] of Object.entries(grouped)) {
      const displayPath = path || 'root';
      lines.push(
        `   ${chalk.yellow('•')} ${chalk.cyan(displayPath)}: ${errors.join(', ')}`,
      );
    }

    // Add hints based on common errors
    const hints = this.getHintsForErrors(error.errors);
    if (hints.length > 0) {
      lines.push('');
      lines.push(chalk.blue('💡 Hints:'));
      hints.forEach((hint) => lines.push(`   ${chalk.yellow('•')} ${hint}`));
    }

    return lines.join('\n');
  }

  /**
   * Groups Zod errors by their path
   * @param errors Array of Zod issues
   * @returns Grouped errors by path
   */
  private static groupErrorsByPath(
    errors: z.ZodIssue[],
  ): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const error of errors) {
      const path = error.path.join('.');
      if (!grouped[path]) {
        grouped[path] = [];
      }

      let message = error.message;

      // Customize messages for better UX
      if (error.code === 'invalid_type') {
        message = `Expected ${error.expected}, received ${error.received}`;
      } else if (
        error.code === 'invalid_string' &&
        error.validation === 'url'
      ) {
        message = 'Invalid URL format';
      } else if (error.code === 'too_small') {
        message = `Must be at least ${error.minimum}`;
      } else if (error.code === 'too_big') {
        message = `Must be at most ${error.maximum}`;
      }

      grouped[path].push(message);
    }

    return grouped;
  }

  /**
   * Provides helpful hints based on validation errors
   * @param errors Array of Zod issues
   * @returns Array of hint strings
   */
  private static getHintsForErrors(errors: z.ZodIssue[]): string[] {
    const hints: string[] = [];

    if (errors.some((e) => e.path.includes('requests'))) {
      hints.push(
        'Use "tressi init" to create a configuration with example requests',
      );
    }

    if (errors.some((e) => e.path.includes('options'))) {
      hints.push(
        'Check the configuration reference at: https://github.com/kevinchatham/tressi',
      );
    }

    if (
      errors.some((e) => e.code === 'invalid_type' && e.path.includes('url'))
    ) {
      hints.push('URLs must include protocol (http:// or https://)');
    }

    if (errors.some((e) => e.path.includes('rps'))) {
      hints.push('RPS must be positive integers');
    }

    if (errors.some((e) => e.path.includes('earlyExitOnError'))) {
      hints.push(
        'When earlyExitOnError is true, specify at least one threshold condition',
      );
    }

    return hints;
  }
}

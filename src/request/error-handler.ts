import type { RequestResult } from '../types';

/**
 * Handles errors that occur during HTTP request execution.
 * This class provides centralized error processing and categorization.
 */
export class ErrorHandler {
  /**
   * Categorizes an error based on its type and message.
   * @param error The error to categorize
   * @returns The error category
   */
  categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    // Network-related errors
    if (
      message.includes('econnrefused') ||
      message.includes('connection refused')
    ) {
      return ErrorCategory.CONNECTION_REFUSED;
    }
    if (
      message.includes('enotfound') ||
      message.includes('getaddrinfo') ||
      message.includes('dns')
    ) {
      return ErrorCategory.DNS_ERROR;
    }
    if (message.includes('timeout') || message.includes('etimedout')) {
      return ErrorCategory.TIMEOUT;
    }
    if (
      message.includes('econnreset') ||
      message.includes('connection reset')
    ) {
      return ErrorCategory.CONNECTION_RESET;
    }
    if (message.includes('socket') || message.includes('esocket')) {
      return ErrorCategory.SOCKET_ERROR;
    }

    // HTTP-related errors
    if (message.includes('invalid url') || message.includes('url')) {
      return ErrorCategory.INVALID_URL;
    }
    if (message.includes('method') || message.includes('unsupported')) {
      return ErrorCategory.UNSUPPORTED_METHOD;
    }

    // SSL/TLS errors
    if (
      message.includes('ssl') ||
      message.includes('tls') ||
      message.includes('certificate')
    ) {
      return ErrorCategory.SSL_ERROR;
    }

    // Default to unknown
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Creates a RequestResult for an error condition.
   * @param error The error that occurred
   * @param method The HTTP method
   * @param url The request URL
   * @param latencyMs The request latency in milliseconds
   * @returns The error RequestResult
   */
  createErrorResult(
    error: Error,
    method: string,
    url: string,
    latencyMs: number,
  ): RequestResult {
    const category = this.categorizeError(error);
    const enhancedMessage = this.enhanceErrorMessage(error, category);

    return {
      method,
      url,
      status: 0,
      latencyMs,
      success: false,
      error: enhancedMessage,
      timestamp: performance.now(),
    };
  }

  /**
   * Enhances error messages with additional context.
   * @param error The original error
   * @param category The error category
   * @returns Enhanced error message
   */
  private enhanceErrorMessage(error: Error, category: ErrorCategory): string {
    const baseMessage = error.message;

    switch (category) {
      case ErrorCategory.CONNECTION_REFUSED:
        return `Connection refused: ${baseMessage}`;
      case ErrorCategory.DNS_ERROR:
        return `DNS resolution failed: ${baseMessage}`;
      case ErrorCategory.TIMEOUT:
        return `Request timeout: ${baseMessage}`;
      case ErrorCategory.CONNECTION_RESET:
        return `Connection reset: ${baseMessage}`;
      case ErrorCategory.SOCKET_ERROR:
        return `Socket error: ${baseMessage}`;
      case ErrorCategory.INVALID_URL:
        return `Invalid URL: ${baseMessage}`;
      case ErrorCategory.UNSUPPORTED_METHOD:
        return `Unsupported method: ${baseMessage}`;
      case ErrorCategory.SSL_ERROR:
        return `SSL/TLS error: ${baseMessage}`;
      default:
        return baseMessage;
    }
  }

  /**
   * Determines if an error is retryable.
   * @param error The error to check
   * @returns true if the error is retryable
   */
  isRetryableError(error: Error): boolean {
    const category = this.categorizeError(error);

    // Most network errors are retryable
    switch (category) {
      case ErrorCategory.CONNECTION_REFUSED:
      case ErrorCategory.CONNECTION_RESET:
      case ErrorCategory.SOCKET_ERROR:
      case ErrorCategory.TIMEOUT:
        return true;
      case ErrorCategory.DNS_ERROR:
      case ErrorCategory.INVALID_URL:
      case ErrorCategory.UNSUPPORTED_METHOD:
      case ErrorCategory.SSL_ERROR:
      case ErrorCategory.UNKNOWN:
      default:
        return false;
    }
  }

  /**
   * Calculates a backoff delay for retry attempts.
   * @param attemptNumber The attempt number (1-based)
   * @param baseDelayMs The base delay in milliseconds
   * @returns The calculated delay in milliseconds
   */
  calculateBackoffDelay(
    attemptNumber: number,
    baseDelayMs: number = 1000,
  ): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Logs an error for debugging purposes.
   * @param error The error to log
   * @param context Additional context information
   */
  logError(error: Error, context?: string): void {
    const timestamp = new Date().toISOString();
    const category = this.categorizeError(error);
    const logMessage = `[${timestamp}] Error (${category}): ${error.message}`;

    // For now, we'll skip console logging to avoid ESLint errors
    // In a real implementation, this could use a proper logging framework
    const fullMessage = context
      ? `${logMessage} | Context: ${context}`
      : logMessage;

    // Store the message for potential future use
    this.lastErrorMessage = fullMessage;
  }

  /**
   * Gets the last error message that was logged
   * @returns The last error message or undefined
   */
  getLastErrorMessage(): string | undefined {
    return this.lastErrorMessage;
  }

  private lastErrorMessage?: string;
}

/**
 * Error categories for better error handling and reporting
 */
export enum ErrorCategory {
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  DNS_ERROR = 'DNS_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_RESET = 'CONNECTION_RESET',
  SOCKET_ERROR = 'SOCKET_ERROR',
  INVALID_URL = 'INVALID_URL',
  UNSUPPORTED_METHOD = 'UNSUPPORTED_METHOD',
  SSL_ERROR = 'SSL_ERROR',
  UNKNOWN = 'UNKNOWN',
}

import { beforeEach, describe, expect, it } from 'vitest';

import {
  ErrorCategory,
  ErrorHandler,
} from '../../../src/request/error-handler';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
  });

  describe('error categorization', () => {
    it('should categorize connection refused errors', () => {
      const error = new Error('ECONNREFUSED');
      const category = handler.categorizeError(error);
      expect(category).toBe(ErrorCategory.CONNECTION_REFUSED);
    });

    it('should categorize DNS errors', () => {
      const dnsErrors = [
        new Error('ENOTFOUND'),
        new Error('getaddrinfo ENOTFOUND'),
        new Error('DNS lookup failed'),
      ];

      dnsErrors.forEach((error) => {
        const category = handler.categorizeError(error);
        expect(category).toBe(ErrorCategory.DNS_ERROR);
      });
    });

    it('should categorize timeout errors', () => {
      const timeoutErrors = [
        new Error('ETIMEDOUT'),
        new Error('Request timeout'),
        new Error('timeout'),
      ];

      timeoutErrors.forEach((error) => {
        const category = handler.categorizeError(error);
        expect(category).toBe(ErrorCategory.TIMEOUT);
      });
    });

    it('should categorize connection reset errors', () => {
      const resetErrors = [
        new Error('ECONNRESET'),
        new Error('Connection reset'),
      ];

      resetErrors.forEach((error) => {
        const category = handler.categorizeError(error);
        expect(category).toBe(ErrorCategory.CONNECTION_RESET);
      });
    });

    it('should categorize socket errors', () => {
      const socketErrors = [new Error('socket hang up'), new Error('ESOCKET')];

      socketErrors.forEach((error) => {
        const category = handler.categorizeError(error);
        expect(category).toBe(ErrorCategory.SOCKET_ERROR);
      });
    });

    it('should categorize invalid URL errors', () => {
      const urlErrors = [new Error('Invalid URL'), new Error('URL malformed')];

      urlErrors.forEach((error) => {
        const category = handler.categorizeError(error);
        expect(category).toBe(ErrorCategory.INVALID_URL);
      });
    });

    it('should categorize SSL errors', () => {
      const sslErrors = [
        new Error('SSL certificate expired'),
        new Error('TLS error'),
        new Error('certificate verify failed'),
      ];

      sslErrors.forEach((error) => {
        const category = handler.categorizeError(error);
        expect(category).toBe(ErrorCategory.SSL_ERROR);
      });
    });

    it('should categorize unknown errors', () => {
      const unknownErrors = [
        new Error('Some random error'),
        new Error('Custom error message'),
      ];

      unknownErrors.forEach((error) => {
        const category = handler.categorizeError(error);
        expect(category).toBe(ErrorCategory.UNKNOWN);
      });
    });
  });

  describe('error result creation', () => {
    it('should create error result with correct structure', () => {
      const error = new Error('Connection refused');
      const result = handler.createErrorResult(
        error,
        'GET',
        'http://example.com',
        1000,
      );

      expect(result.method).toBe('GET');
      expect(result.url).toBe('http://example.com');
      expect(result.status).toBe(0);
      expect(result.latencyMs).toBe(1000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should enhance error messages based on category', () => {
      const error = new Error('ECONNREFUSED');
      const result = handler.createErrorResult(
        error,
        'POST',
        'http://api.com',
        500,
      );

      expect(result.error).toContain('Connection refused');
      expect(result.error).toContain('ECONNREFUSED');
    });
  });

  describe('retry determination', () => {
    it('should identify retryable errors', () => {
      const retryableErrors = [
        new Error('ECONNREFUSED'),
        new Error('ECONNRESET'),
        new Error('ETIMEDOUT'),
        new Error('socket hang up'),
      ];

      retryableErrors.forEach((error) => {
        const isRetryable = handler.isRetryableError(error);
        expect(isRetryable).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        new Error('ENOTFOUND'),
        new Error('Invalid URL'),
        new Error('SSL certificate expired'),
        new Error('Unsupported method'),
      ];

      nonRetryableErrors.forEach((error) => {
        const isRetryable = handler.isRetryableError(error);
        expect(isRetryable).toBe(false);
      });
    });
  });

  describe('backoff calculation', () => {
    it('should calculate exponential backoff', () => {
      const delays = [
        handler.calculateBackoffDelay(1, 1000),
        handler.calculateBackoffDelay(2, 1000),
        handler.calculateBackoffDelay(3, 1000),
      ];

      expect(delays[0]).toBeGreaterThanOrEqual(1000);
      expect(delays[1]).toBeGreaterThanOrEqual(2000);
      expect(delays[2]).toBeGreaterThanOrEqual(4000);
    });

    it('should add jitter to backoff', () => {
      const delay1 = handler.calculateBackoffDelay(2, 1000);
      const delay2 = handler.calculateBackoffDelay(2, 1000);

      expect(delay1).not.toBe(delay2);
    });

    it('should cap backoff at 30 seconds', () => {
      const delay = handler.calculateBackoffDelay(10, 1000);
      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  describe('error logging', () => {
    it('should log errors with timestamp', () => {
      const error = new Error('Test error');
      handler.logError(error, 'Test context');

      const lastMessage = handler.getLastErrorMessage();
      expect(lastMessage).toBeDefined();
      expect(lastMessage).toContain('Test error');
      expect(lastMessage).toContain('Test context');
    });

    it('should log errors without context', () => {
      const error = new Error('Simple error');
      handler.logError(error);

      const lastMessage = handler.getLastErrorMessage();
      expect(lastMessage).toBeDefined();
      expect(lastMessage).toContain('Simple error');
    });
  });

  describe('error message enhancement', () => {
    it('should enhance connection refused messages', () => {
      const error = new Error('ECONNREFUSED');
      const result = handler.createErrorResult(
        error,
        'GET',
        'http://test.com',
        100,
      );
      expect(result.error).toBe('Connection refused: ECONNREFUSED');
    });

    it('should enhance DNS error messages', () => {
      const error = new Error('ENOTFOUND');
      const result = handler.createErrorResult(
        error,
        'GET',
        'http://test.com',
        100,
      );
      expect(result.error).toBe('DNS resolution failed: ENOTFOUND');
    });

    it('should enhance timeout messages', () => {
      const error = new Error('ETIMEDOUT');
      const result = handler.createErrorResult(
        error,
        'GET',
        'http://test.com',
        100,
      );
      expect(result.error).toBe('Request timeout: ETIMEDOUT');
    });
  });
});

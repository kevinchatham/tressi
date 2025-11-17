import { describe, expect, it } from 'vitest';

import { ConfigValidator } from '../../../src/validation/config-validator';

describe('ConfigValidator', () => {
  describe('validateWithResult', () => {
    it('should validate conflicting useUI and silent options', () => {
      const invalidConfig = {
        $schema: 'https://example.com/schema.json',
        requests: [
          {
            url: 'https://example.com',
            method: 'GET',
          },
        ],
        options: {
          useUI: true,
          silent: true,
          durationSec: 10,
          rampUpTimeSec: 0,
          earlyExitOnError: false,
        },
      };

      const result = ConfigValidator.validateWithResult(invalidConfig);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.message).toContain(
          'Configuration validation failed',
        );
      }
    });

    it('should allow useUI: true and silent: false', () => {
      const validConfig = {
        $schema: 'https://example.com/schema.json',
        requests: [
          {
            url: 'https://example.com',
            method: 'GET',
          },
        ],
        options: {
          useUI: true,
          silent: false,
          durationSec: 10,
          rampUpTimeSec: 0,
          earlyExitOnError: false,
        },
      };

      const result = ConfigValidator.validateWithResult(validConfig);

      expect(result.success).toBe(true);
      if (result.success === true) {
        expect(result.data.options.useUI).toBe(true);
        expect(result.data.options.silent).toBe(false);
      }
    });

    it('should allow useUI: false and silent: true', () => {
      const validConfig = {
        $schema: 'https://example.com/schema.json',
        requests: [
          {
            url: 'https://example.com',
            method: 'GET',
          },
        ],
        options: {
          useUI: false,
          silent: true,
          durationSec: 10,
          rampUpTimeSec: 0,
          earlyExitOnError: false,
        },
      };

      const result = ConfigValidator.validateWithResult(validConfig);

      expect(result.success).toBe(true);
    });

    it('should validate complete configuration', () => {
      const validConfig = {
        $schema: 'https://example.com/schema.json',
        requests: [
          {
            url: 'https://example.com',
            method: 'GET',
          },
        ],
        options: {
          durationSec: 10,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
          earlyExitOnError: false,
        },
      };

      const result = ConfigValidator.validateWithResult(validConfig);

      expect(result.success).toBe(true);
    });
  });

  describe('validateForProgrammatic', () => {
    it('should validate early exit configuration', () => {
      const config = {
        $schema: 'https://example.com/schema.json',
        requests: [
          {
            url: 'https://example.com',
            method: 'GET',
          },
        ],
        options: {
          earlyExitOnError: true,
          errorRateThreshold: 0.5,
          durationSec: 10,
          rampUpTimeSec: 0,
          useUI: true,
          silent: false,
        },
      };

      const result = ConfigValidator.validateForProgrammatic(config);

      expect(result.options.earlyExitOnError).toBe(true);
      expect(result.options.errorRateThreshold).toBe(0.5);
    });
  });
});

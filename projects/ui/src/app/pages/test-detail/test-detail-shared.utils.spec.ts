import { describe, expect, it } from 'vitest';

import { isEndpointSummary } from './test-detail-shared.utils';

describe('test-detail-shared.utils', () => {
  describe('isEndpointSummary', () => {
    it('should return true for a valid EndpointSummary object', () => {
      const validSummary = {
        responseSamples: [],
        statusCodeDistribution: { '200': 100 },
        url: 'https://api.example.com',
      };

      expect(isEndpointSummary(validSummary)).toBe(true);
    });

    it('should return false for a GlobalSummary (missing statusCodeDistribution)', () => {
      const globalSummary = {
        totalRequests: 1000,
        url: 'global',
        // Missing statusCodeDistribution
      };

      expect(isEndpointSummary(globalSummary)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isEndpointSummary(null)).toBe(false);
      expect(isEndpointSummary(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isEndpointSummary('not an object')).toBe(false);
      expect(isEndpointSummary(123)).toBe(false);
      expect(isEndpointSummary([])).toBe(false);
    });

    it('should return false for an empty object', () => {
      expect(isEndpointSummary({})).toBe(false);
    });
  });
});

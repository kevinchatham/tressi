import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportingUtils } from './reporting-utils';

describe('ReportingUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStatusCodeDistributionByCategory', () => {
    it('should correctly distribute status codes', () => {
      const statusCodeMap = {
        200: 10,
        201: 5,
        301: 2,
        404: 3,
        500: 1,
        999: 1,
      };

      const result = ReportingUtils.getStatusCodeDistributionByCategory(statusCodeMap);

      expect(result).toEqual({
        '2xx': 15,
        '3xx': 2,
        '4xx': 3,
        '5xx': 1,
        other: 1,
      });
    });

    it('should return zeros for empty map', () => {
      const result = ReportingUtils.getStatusCodeDistributionByCategory({});
      expect(result).toEqual({
        '2xx': 0,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0,
        other: 0,
      });
    });

    it('should handle large counts', () => {
      const statusCodeMap = {
        200: 1000000,
        500: 500000,
      };

      const result = ReportingUtils.getStatusCodeDistributionByCategory(statusCodeMap);

      expect(result['2xx']).toBe(1000000);
      expect(result['5xx']).toBe(500000);
    });
  });
});

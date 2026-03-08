import { EndpointSummary } from '@tressi/shared/common';
import { describe, expect, it } from 'vitest';

import { aggregateStatusCodesFromEndpoints } from './status-code-aggregator';

describe('aggregateStatusCodesFromEndpoints', () => {
  it('should aggregate status codes from multiple endpoints', () => {
    const endpoints = [
      { statusCodeDistribution: { 200: 100, 404: 5 } },
      { statusCodeDistribution: { 200: 50, 500: 2 } },
    ] as unknown as EndpointSummary[];

    const result = aggregateStatusCodesFromEndpoints(endpoints);
    expect(result).toEqual({ 200: 150, 404: 5, 500: 2 });
  });

  it('should return empty object for no endpoints', () => {
    const result = aggregateStatusCodesFromEndpoints([]);
    expect(result).toEqual({});
  });

  it('should handle endpoints with no status codes', () => {
    const endpoints = [
      { statusCodeDistribution: {} },
    ] as unknown as EndpointSummary[];
    const result = aggregateStatusCodesFromEndpoints(endpoints);
    expect(result).toEqual({});
  });
});

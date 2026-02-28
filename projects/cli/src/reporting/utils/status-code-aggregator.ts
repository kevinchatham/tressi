import { EndpointSummary } from '@tressi/shared/common';

/**
 * Aggregates status codes from all endpoints into a single map.
 * This utility function consolidates status code distributions from multiple endpoints
 * into a unified map for global analysis.
 *
 * @param endpoints - Array of endpoint summaries containing status code distributions
 * @returns A map of status codes to their total counts across all endpoints
 *
 * @example
 * ```typescript
 * const statusCodeMap = aggregateStatusCodesFromEndpoints(endpoints);
 * // Returns: { 200: 1500, 404: 25, 500: 3 }
 * ```
 */
export function aggregateStatusCodesFromEndpoints(
  endpoints: EndpointSummary[],
): Record<number, number> {
  const statusCodeMap: Record<number, number> = {};

  for (const endpoint of endpoints) {
    for (const [code, count] of Object.entries(
      endpoint.statusCodeDistribution,
    )) {
      const codeNum = parseInt(code, 10);
      statusCodeMap[codeNum] = (statusCodeMap[codeNum] || 0) + count;
    }
  }

  return statusCodeMap;
}

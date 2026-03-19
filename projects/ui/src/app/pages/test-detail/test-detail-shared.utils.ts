import type { EndpointSummary } from '@tressi/shared/common';

/**
 * Type guard to check if a summary is an EndpointSummary
 * EndpointSummary has statusCodeDistribution and responseSamples properties
 * that GlobalSummary does not have
 */
export function isEndpointSummary(summary: unknown): summary is EndpointSummary {
  return summary !== null && typeof summary === 'object' && 'statusCodeDistribution' in summary;
}

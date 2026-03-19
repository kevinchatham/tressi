import type { ErrorApiResponse } from '@tressi/shared/common';

/**
 * Creates a standard API error response
 */
export function createApiErrorResponse(
  message: string,
  code?: string,
  details?: string[],
  path?: string,
): ErrorApiResponse {
  return {
    error: {
      code,
      details,
      message,
      path,
      timestamp: Date.now(),
    },
  };
}

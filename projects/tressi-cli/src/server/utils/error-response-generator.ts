import { ErrorApiResponse } from 'tressi-common/config';

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
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

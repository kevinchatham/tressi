/** biome-ignore-all lint/nursery/useExplicitType: hono */

import type { ErrorApiResponse } from '@tressi/shared/common';
import type { MiddlewareHandler } from 'hono';

/**
 * Create error handling middleware
 */
export function createErrorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      const errorResponse: ErrorApiResponse = {
        error: {
          code: error instanceof Error && 'code' in error ? String(error.code) : undefined,
          message: error instanceof Error ? error.message : 'Internal server error',
          path: c.req.path,
          timestamp: Date.now(),
        },
      };

      const status = determineErrorStatus(error);

      return c.json(errorResponse, status);
    }
  };
}

function determineErrorStatus(error: unknown): 400 | 401 | 403 | 404 | 409 | 422 | 500 {
  if (!(error instanceof Error)) return 500;

  if ('status' in error && typeof error.status === 'number') {
    const statusNum = error.status;
    if ([400, 401, 403, 404, 409, 422, 500].includes(statusNum)) {
      return statusNum as 400 | 401 | 403 | 404 | 409 | 422 | 500;
    }
  }

  if (error.message.includes('not found') || error.message.includes('Not found')) {
    return 404;
  }

  return 500;
}

/**
 * Default error middleware
 */
export const errorMiddleware = createErrorHandler();

import type { MiddlewareHandler } from 'hono';
import { ErrorApiResponse } from 'tressi-common/api';

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
          message:
            error instanceof Error ? error.message : 'Internal server error',
          code:
            error instanceof Error && 'code' in error
              ? String(error.code)
              : undefined,
          timestamp: new Date().toISOString(),
          path: c.req.path,
        },
      };

      // Determine status code
      let status: 400 | 401 | 403 | 404 | 409 | 422 | 500 = 500;
      if (error instanceof Error) {
        if ('status' in error && typeof error.status === 'number') {
          const statusNum = error.status;
          if ([400, 401, 403, 404, 409, 422, 500].includes(statusNum)) {
            status = statusNum as 400 | 401 | 403 | 404 | 409 | 422 | 500;
          }
        } else if (
          error.message.includes('not found') ||
          error.message.includes('Not found')
        ) {
          status = 404;
        }
      }

      return c.json(errorResponse, status);
    }
  };
}

/**
 * Default error middleware
 */
export const errorMiddleware = createErrorHandler();

import type { TypedResponse } from 'hono';
import { createFactory } from 'hono/factory';
import { HealthApiResponse } from 'tressi-common/api';

const factory = createFactory();

/**
 * Health check endpoint handler
 */
export const healthHandler = factory.createHandlers(
  (c): TypedResponse<HealthApiResponse> => {
    const response: HealthApiResponse = {
      status: 'ok',
      service: 'tressi-server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    return c.json(response);
  },
);

import { Hono } from 'hono';

/**
 * Health check endpoint for monitoring service status.
 * Provides basic health information including service name, timestamp, and uptime.
 */
const app = new Hono()
  /**
   * GET / - Returns health status of the service
   * @returns {Response} JSON response with health status information
   */
  .get('/', (c) => {
    return c.json({
      status: 'ok',
      service: 'tressi-server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

export default app;

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { globalEventEmitter } from '../../events/global-event-emitter';
import { ISSEClientManager } from '../../types/workers/interfaces';
import createBrowserApp from './browser';
import configs from './configs';
import health from './health';
import loadTest from './load-test';
import createMetricsApp from './metrics';

/**
 * Creates the main Hono application with all routes and middleware configured.
 * Sets up CORS, logging, and routes for different API endpoints.
 *
 * @param {ISSEClientManager} sseManager - Server-Sent Events manager for metrics streaming
 * @param {number} port - The port number for CORS origin configuration
 * @returns {Hono} Configured Hono application instance
 */
// Return type is explicitly ignored as to not break type inference allowing Hono RPC client to function correctly.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createApp(sseManager: ISSEClientManager, port: number) {
  const app = new Hono()
    .use(logger())
    .use('*', async (c, next) => {
      const middleware = cors({
        origin: [`http://localhost:${port}`, 'http://localhost:4200'],
        credentials: true,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600,
      });
      return middleware(c, next);
    })
    .route('/api/config', configs)
    .route('/api/health', health)
    .route('/api/test', loadTest)
    .route('/api/metrics', createMetricsApp(sseManager))
    .route('/', createBrowserApp());

  globalEventEmitter.on('metrics', (metrics) => {
    sseManager.broadcast(metrics);
  });

  return app;
}

export default createApp;
export type AppType = ReturnType<typeof createApp>;

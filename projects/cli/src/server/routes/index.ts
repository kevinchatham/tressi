/** biome-ignore-all lint/nursery/useExplicitType: hono */

import type { ISSEClientManager } from '@tressi/shared/cli';
import { type ServerEventMessage, ServerEvents } from '@tressi/shared/common';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { globalEventEmitter } from '../../events/global-event-emitter';
import createBrowserApp from './browser-routes';
import configs from './config-routes';
import docs from './docs-routes';
import createMetricsApp from './metrics-routes';
import tests from './test-routes';

/**
 * Creates the main Hono application with all routes and middleware configured.
 * Sets up CORS, logging, and routes for different API endpoints.
 *
 * @param {ISSEClientManager} sseManager - Server-Sent Events manager for metrics streaming
 * @param {number} port - The port number for CORS origin configuration
 * @returns {Hono} Configured Hono application instance
 */
export function createApp(sseManager: ISSEClientManager, port: number) {
  const app = new Hono()
    .use('*', async (c, next) => {
      const middleware = cors({
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        maxAge: 600,
        origin: [`http://localhost:${port}`, 'http://localhost:4200'],
      });
      return middleware(c, next);
    })
    .get('/api/health', (c) => {
      return c.json({
        status: 'ok',
        timestamp: Date.now(),
      });
    })
    .route('/api/config', configs)
    .route('/api/docs', docs)
    .route('/api/test', tests)
    .route('/api/tests', tests)
    .route('/api/metrics', createMetricsApp(sseManager))
    .route('/', createBrowserApp());

  globalEventEmitter.on(ServerEvents.METRICS, (testSummary) => {
    const message: ServerEventMessage = {
      data: testSummary,
      event: ServerEvents.METRICS,
    };
    sseManager.broadcast(message);
  });

  globalEventEmitter.on(ServerEvents.TEST.STARTED, (data) => {
    const message: ServerEventMessage = {
      data,
      event: ServerEvents.TEST.STARTED,
    };
    sseManager.broadcast(message);
  });

  globalEventEmitter.on(ServerEvents.TEST.COMPLETED, (data) => {
    const message: ServerEventMessage = {
      data,
      event: ServerEvents.TEST.COMPLETED,
    };
    sseManager.broadcast(message);
  });

  globalEventEmitter.on(ServerEvents.TEST.FAILED, (data) => {
    const message: ServerEventMessage = {
      data,
      event: ServerEvents.TEST.FAILED,
    };
    sseManager.broadcast(message);
  });

  globalEventEmitter.on(ServerEvents.TEST.CANCELLED, (data) => {
    const message: ServerEventMessage = {
      data,
      event: ServerEvents.TEST.CANCELLED,
    };
    sseManager.broadcast(message);
  });

  return app;
}

export default createApp;

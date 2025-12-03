import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import { serverRoutes } from 'tressi-common/api';

import { ISSEClientManager } from '../../types/workers/interfaces';
import {
  deleteConfigHandler,
  getAllConfigMetadataHandler,
  getConfigHandler,
  saveConfigHandler,
} from './configs';
import { healthHandler } from './health';
import { jobStatusHandler, loadTestHandler } from './load-test';
import { createMetricsHandler } from './metrics';

/**
 * Register all routes with the application
 */
export function registerRoutes(app: Hono, sseManager: ISSEClientManager): void {
  const { health, metrics, test, status } = serverRoutes;

  // Health check endpoint
  app.get(health.route, ...healthHandler);

  // Metrics streaming endpoint
  app.get(metrics.route, createMetricsHandler(sseManager));

  // Load test endpoints
  app.post(test.route, ...loadTestHandler);
  app.get(status.route, ...jobStatusHandler);

  // Configuration management endpoints
  app.get(serverRoutes.configs.route, ...getAllConfigMetadataHandler);
  app.get(serverRoutes.configById.route, ...getConfigHandler);
  app.post(serverRoutes.saveConfig.route, ...saveConfigHandler);
  app.delete(serverRoutes.deleteConfig.route, ...deleteConfigHandler);

  // Serve static files from browser directory
  app.use(
    '/*',
    serveStatic({
      root: './browser',
      rewriteRequestPath: (path) => {
        // For SPA routing: serve index.html for any non-file requests
        const isFileRequest = path.includes('.') && !path.endsWith('/');
        if (!isFileRequest && path !== '/') {
          return '/index.html';
        }
        return path;
      },
    }),
  );
}

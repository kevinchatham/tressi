/** biome-ignore-all lint/nursery/useExplicitType: hono */

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

/**
 * Creates a Hono application for serving static browser files.
 * Handles SPA routing by redirecting non-file requests to index.html.
 */
function createBrowserApp() {
  return new Hono().use(async (c, next) => {
    const middleware = serveStatic({
      rewriteRequestPath: (path: string) => {
        const isFileRequest = path.includes('.') && !path.endsWith('/');
        if (!isFileRequest && path !== '/') {
          return '/index.html';
        }
        return path;
      },
      root: `${__dirname}/browser`,
    });
    return middleware(c, next);
  });
}

export default createBrowserApp;

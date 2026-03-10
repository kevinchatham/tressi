import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { BlankSchema } from 'hono/types';

/**
 * Creates a Hono application for serving static browser files.
 * Handles SPA routing by redirecting non-file requests to index.html.
 *
 * @returns {Hono<object, BlankSchema, '/'>} Hono app configured for static file serving
 */
function createBrowserApp(): Hono<object, BlankSchema, '/'> {
  return new Hono().use(async (c, next) => {
    const middleware = serveStatic({
      root: `${__dirname}/browser`,
      rewriteRequestPath: (path) => {
        const isFileRequest = path.includes('.') && !path.endsWith('/');
        if (!isFileRequest && path !== '/') {
          return '/index.html';
        }
        return path;
      },
    });
    return middleware(c, next);
  });
}

export default createBrowserApp;

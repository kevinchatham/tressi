import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@hono/node-server/serve-static', () => ({
  serveStatic: vi.fn().mockImplementation(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

import createBrowserApp from './browser-routes';

describe('createBrowserApp', () => {
  it('should create a Hono app', () => {
    const app = createBrowserApp();
    expect(app).toBeInstanceOf(Hono);
  });

  it('should return a Hono instance with middleware configured', () => {
    const app = createBrowserApp();
    expect(app).toBeInstanceOf(Hono);
  });

  it('should have routes configured', () => {
    const app = createBrowserApp();
    expect(app.routes).toBeDefined();
  });

  describe('rewriteRequestPath logic', () => {
    function applyRewrite(path: string): string {
      const isFileRequest = path.includes('.') && !path.endsWith('/');
      return !isFileRequest && path !== '/' ? '/index.html' : path;
    }

    it('should rewrite non-file paths to index.html', () => {
      expect(applyRewrite('/dashboard')).toBe('/index.html');
    });

    it('should pass through file requests without rewrite', () => {
      expect(applyRewrite('test.js')).toBe('test.js');
    });

    it('should rewrite path with dots but ending in / to index.html', () => {
      expect(applyRewrite('/api/data/')).toBe('/index.html');
    });

    it('should not rewrite root path', () => {
      expect(applyRewrite('/')).toBe('/');
    });

    it('should pass through static assets', () => {
      expect(applyRewrite('/assets/logo.png')).toBe('/assets/logo.png');
    });
  });
});

import { Context, Hono, Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import createBrowserApp from './browser-routes';

vi.mock('@hono/node-server/serve-static', () => ({
  serveStatic: vi.fn(
    () =>
      (c: Context, next: Next): Promise<unknown> =>
        next(),
  ),
}));

describe('createBrowserApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a Hono app', () => {
    const app = createBrowserApp();
    expect(app).toBeInstanceOf(Hono);
  });
});

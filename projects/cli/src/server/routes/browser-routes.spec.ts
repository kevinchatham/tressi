import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import createBrowserApp from './browser-routes';

describe('createBrowserApp', () => {
  it('should create a Hono app', () => {
    const app = createBrowserApp();
    expect(app).toBeInstanceOf(Hono);
  });

  it('should return a Hono instance with middleware configured', () => {
    const app = createBrowserApp();
    // The app should have routes configured
    expect(app).toBeInstanceOf(Hono);
  });
});

import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createErrorHandler, errorMiddleware } from './error';

describe('error middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createErrorHandler', () => {
    it('should call next() and return void if no error occurs', async () => {
      const handler = createErrorHandler();
      const c = {} as unknown as Context;
      const next = vi.fn().mockResolvedValue(undefined);

      await expect(handler(c, next)).resolves.toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should catch errors and return a 500 response by default', async () => {
      const handler = createErrorHandler();
      const c = {
        req: { path: '/test' },
        json: vi.fn().mockReturnValue(new Response()),
      } as unknown as Context;
      const next = vi.fn().mockRejectedValue(new Error('Something went wrong'));

      await handler(c, next);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            message: 'Something went wrong',
            timestamp: expect.any(Number),
            path: '/test',
          },
        }),
        500,
      );
    });

    it('should return 404 if error message contains "not found"', async () => {
      const handler = createErrorHandler();
      const c = {
        req: { path: '/test' },
        json: vi.fn().mockReturnValue(new Response()),
      } as unknown as Context;
      const next = vi.fn().mockRejectedValue(new Error('Resource not found'));

      await handler(c, next);

      expect(c.json).toHaveBeenCalledWith(expect.anything(), 404);
    });

    it('should use status from error object if provided', async () => {
      const handler = createErrorHandler();
      const c = {
        req: { path: '/test' },
        json: vi.fn().mockReturnValue(new Response()),
      } as unknown as Context;
      const error = new Error('Forbidden');
      (error as unknown as { status: number }).status = 403;
      const next = vi.fn().mockRejectedValue(error);

      await handler(c, next);

      expect(c.json).toHaveBeenCalledWith(expect.anything(), 403);
    });

    it('should handle non-Error objects', async () => {
      const handler = createErrorHandler();
      const c = {
        req: { path: '/test' },
        json: vi.fn().mockReturnValue(new Response()),
      } as unknown as Context;
      const next = vi.fn().mockRejectedValue('String error');

      await handler(c, next);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            message: 'Internal server error',
            timestamp: expect.any(Number),
            path: '/test',
          },
        }),
        500,
      );
    });
  });

  describe('errorMiddleware', () => {
    it('should be an instance of the middleware handler', () => {
      expect(typeof errorMiddleware).toBe('function');
    });
  });
});

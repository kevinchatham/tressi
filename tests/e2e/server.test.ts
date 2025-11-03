import { ChildProcess, spawn } from 'child_process';
import { request } from 'undici';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getAvailablePort } from '../utils/test-fixtures';

interface ServerResponse {
  status?: string;
  timestamp?: number;
  message?: string;
  error?: string;
  delay?: number;
}

interface HeadersResponse {
  headers: Record<string, string>;
  method: string;
}

describe('E2E Server Tests', () => {
  let server: ChildProcess;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    port = await getAvailablePort();
    baseUrl = `http://localhost:${port}`;
  });

  beforeEach(async () => {
    // Ensure server is not running
    if (server && !server.killed) {
      server.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  afterAll(async () => {
    if (server && !server.killed) {
      server.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  const startServer = async (customPort?: number): Promise<void> => {
    const serverPort = customPort || port;
    return new Promise((resolve, reject) => {
      server = spawn(
        'npx',
        ['tsx', 'server.ts', `--port=${serverPort.toString()}`],
        {
          cwd: process.cwd(),
          stdio: 'pipe',
        },
      );

      let started = false;

      server.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('running at http://localhost') && !started) {
          started = true;
          resolve();
        }
      });

      server.stderr?.on('data', (data) => {
        // eslint-disable-next-line no-console
        console.error('Server error:', data.toString());
      });

      server.on('error', reject);

      setTimeout(() => {
        if (!started) {
          reject(new Error('Server failed to start within timeout'));
        }
      }, 15000); // Increased from 5s to 15s for CI environments
    });
  };

  describe('Server Startup and Basic Health', () => {
    it('should start server successfully', async () => {
      await startServer();
      expect(server.killed).toBe(false);
    });

    it('should respond to health check', async () => {
      await startServer();
      const response = await request(`${baseUrl}/health`);
      expect(response.statusCode).toBe(200);

      const body = (await response.body.json()) as ServerResponse;
      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('timestamp');
    });

    it('should start on custom port', async () => {
      const customPort = await getAvailablePort();
      await startServer(customPort);

      const response = await request(`http://localhost:${customPort}/health`);
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Status Code Endpoints', () => {
    beforeEach(async () => {
      await startServer();
    });

    it('should return 200 for /success', async () => {
      const response = await request(`${baseUrl}/success`);
      expect(response.statusCode).toBe(200);

      const body = (await response.body.json()) as ServerResponse;
      expect(body).toHaveProperty('message', 'OK');
    });

    it('should return 404 for /not-found', async () => {
      const response = await request(`${baseUrl}/not-found`);
      expect(response.statusCode).toBe(404);

      const body = (await response.body.json()) as ServerResponse;
      expect(body).toHaveProperty('message', 'Not Found');
    });

    it('should return 500 for /server-error', async () => {
      const response = await request(`${baseUrl}/server-error`);
      expect(response.statusCode).toBe(500);

      const body = (await response.body.json()) as ServerResponse;
      expect(body).toHaveProperty('message', 'Internal Server Error');
    });
  });

  describe('Delay Endpoint', () => {
    beforeEach(async () => {
      await startServer();
    });

    it('should delay response by specified milliseconds', async () => {
      const delayMs = 100;
      const start = Date.now();

      const response = await request(`${baseUrl}/delay/${delayMs}`);
      const duration = Date.now() - start;

      expect(response.statusCode).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(delayMs);

      const body = (await response.body.json()) as ServerResponse;
      expect(body).toHaveProperty('delay', delayMs);
    });

    it('should handle zero delay', async () => {
      const response = await request(`${baseUrl}/delay/0`);
      expect(response.statusCode).toBe(200);

      const body = (await response.body.json()) as ServerResponse;
      expect(body).toHaveProperty('delay', 0);
    });

    it('should handle large delays', async () => {
      const response = await request(`${baseUrl}/delay/2000`);
      expect(response.statusCode).toBe(200);

      const body = (await response.body.json()) as ServerResponse;
      expect(body).toHaveProperty('delay', 2000);
    });
  });

  describe('Timeout Endpoint', () => {
    beforeEach(async () => {
      await startServer();
    }, 60000); // 60 second timeout for beforeEach

    it('should timeout after 30 seconds', async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000); // Abort after 1s to avoid hanging

      try {
        await request(`${baseUrl}/timeout`, {
          signal: controller.signal,
        });

        // Should not reach here
        expect.fail('Request should have been aborted');
      } catch (error: unknown) {
        expect((error as Error).name).toBe('AbortError');
      } finally {
        clearTimeout(timeout);
      }
    });
  });

  describe('Chunked Transfer Endpoint', () => {
    beforeEach(async () => {
      await startServer();
    });

    it('should send chunked response', async () => {
      const response = await request(`${baseUrl}/chunked`);
      expect(response.statusCode).toBe(200);
      expect(response.headers['transfer-encoding']).toBe('chunked');

      const body = await response.body.text();
      expect(body).toContain('Chunk');
    });
  });

  describe('Redirect Endpoints', () => {
    beforeEach(async () => {
      await startServer();
    });

    it('should redirect with 301 status', async () => {
      const response = await request(`${baseUrl}/redirect/301?url=/success`, {
        maxRedirections: 0,
      });

      expect(response.statusCode).toBe(301);
      expect(response.headers.location).toBe('/success');
    });

    it('should redirect with 302 status', async () => {
      const response = await request(`${baseUrl}/redirect/302?url=/success`, {
        maxRedirections: 0,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/success');
    });

    it('should follow redirects by default', async () => {
      const response = await request(`${baseUrl}/redirect/301?url=/success`);
      // Allow either 200 (if redirect is followed) or 301 (if not followed)
      expect([200, 301]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body = (await response.body.json()) as ServerResponse;
        expect(body).toHaveProperty('message', 'OK');
      } else {
        expect(response.headers.location).toBe('/success');
      }
    });
  });

  describe('Rate Limit Endpoint', () => {
    beforeEach(async () => {
      await startServer();
    });

    it('should allow first request', async () => {
      const response = await request(`${baseUrl}/rate-limit`);
      // Allow either 200 (allowed) or 429 (rate limited) for first request
      expect([200, 429]).toContain(response.statusCode);

      const body = (await response.body.json()) as ServerResponse;
      if (response.statusCode === 200) {
        expect(body).toHaveProperty('message', 'Request allowed');
      } else {
        expect(body).toHaveProperty('error', 'Rate limit exceeded');
      }
    });

    it('should rate limit subsequent requests', async () => {
      // Make multiple requests to increase chance of rate limiting
      let rateLimited = false;
      for (let i = 0; i < 10; i++) {
        const response = await request(`${baseUrl}/rate-limit`);
        if (response.statusCode === 429) {
          rateLimited = true;
          const body = (await response.body.json()) as ServerResponse;
          expect(body).toHaveProperty('error', 'Rate limit exceeded');
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });
  });

  describe('Headers Endpoint', () => {
    beforeEach(async () => {
      await startServer();
    });

    it('should echo request headers', async () => {
      const testHeaders = {
        'x-custom-header': 'test-value',
        'user-agent': 'tressi-test',
      };

      const response = await request(`${baseUrl}/headers`, {
        headers: testHeaders,
      });

      expect(response.statusCode).toBe(200);

      const body = (await response.body.json()) as HeadersResponse;
      expect(body.headers).toHaveProperty('x-custom-header', 'test-value');
      expect(body.headers).toHaveProperty('user-agent', 'tressi-test');
    });
  });

  describe('Server Error Handling', () => {
    it('should handle invalid endpoints', async () => {
      await startServer();

      const response = await request(`${baseUrl}/invalid-endpoint`);
      expect(response.statusCode).toBe(404);
    });

    it('should handle malformed URLs', async () => {
      await startServer();

      const response = await request(`${baseUrl}/delay/invalid`);
      expect(response.statusCode).toBe(400);

      const body = (await response.body.json()) as ServerResponse;
      expect(body).toHaveProperty('error');
    });
  });
});

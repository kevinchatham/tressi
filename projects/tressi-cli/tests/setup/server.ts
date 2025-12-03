/**
 * Tressi Test Server - HTTP Testing Endpoints
 *
 * This server provides various HTTP endpoints for testing different scenarios:
 *
 * HEALTH & METRICS:
 * - GET /health - Health check with uptime and request count
 * - GET /metrics - Server metrics (uptime, requests, memory usage)
 * - GET /config - Server configuration details
 *
 * STATUS CODE TESTING:
 * - GET /status/:code - Returns specified HTTP status code (100-599)
 * - GET /success - 200 OK
 * - GET /created - 201 Created
 * - GET /accepted - 202 Accepted
 * - GET /bad-request - 400 Bad Request
 * - GET /unauthorized - 401 Unauthorized
 * - GET /forbidden - 403 Forbidden
 * - GET /not-found - 404 Not Found
 * - GET /server-error - 500 Internal Server Error
 * - GET /service-unavailable - 503 Service Unavailable
 *
 * TIMING & PERFORMANCE:
 * - GET /delay/:ms - Delays response by specified milliseconds (max 30s)
 * - GET /timeout - Never responds (for timeout testing)
 * - GET /slow-response - Slow incremental JSON response over 5 seconds
 * - GET /chunked - Chunked transfer encoding with 5 chunks over 5 seconds
 *
 * RESPONSE SIZE TESTING:
 * - GET /random-size - Returns random response size (100-10100 bytes)
 * - GET /payload/:size - Returns response of specified size in KB (1-100 KB)
 *
 * REQUEST INSPECTION:
 * - GET /echo - Echoes request data (method, URL, headers, query)
 * - POST /echo - Echoes request data including body
 * - GET /headers - Returns request headers and client info
 * - GET /ip - Returns client IP address
 *
 * REDIRECT TESTING:
 * - GET /redirect/:code - Redirects to specified URL with given status code
 *   Valid codes: 301, 302, 303, 307, 308
 *   Usage: /redirect/301?url=https://example.com
 *
 * MISCELLANEOUS:
 * - GET /rate-limit - 30% chance of returning 429 rate limit error
 * - GET / - Root endpoint with available endpoints documentation
 */

/**
 * Tressi Test Server - HTTP Testing Endpoints
 *
 * This server provides various HTTP endpoints for testing different scenarios.
 * All endpoints support GET method unless specified otherwise.
 *
 * ENDPOINTS BY HTTP METHOD:
 *
 * GET endpoints:
 * - /health - Health check with uptime and request count
 * - /status/:code - Returns specified HTTP status code (100-599)
 * - /success - 200 OK response
 * - /created - 201 Created response
 * - /accepted - 202 Accepted response
 * - /bad-request - 400 Bad Request response
 * - /unauthorized - 401 Unauthorized response
 * - /forbidden - 403 Forbidden response
 * - /not-found - 404 Not Found response
 * - /server-error - 500 Internal Server Error response
 * - /service-unavailable - 503 Service Unavailable response
 * - /delay/:ms - Delays response by specified milliseconds (max 30s)
 * - /timeout - Never responds (for timeout testing)
 * - /chunked - Chunked transfer encoding with 5 chunks over 5 seconds
 * - /random-size - Returns random response size (100-10100 bytes)
 * - /headers - Returns request headers and client info
 * - /ip - Returns client IP address
 * - /metrics - Server metrics (uptime, requests, memory usage)
 * - /config - Server configuration details
 * - /redirect/:code - Redirects to specified URL with given status code
 *   Usage: /redirect/301?url=https://example.com
 *   Valid codes: 301, 302, 303, 307, 308
 * - /payload/:size - Returns response of specified size in KB (1-100 KB)
 * - /slow-response - Slow incremental JSON response over 5 seconds
 * - /rate-limit - 30% chance of returning 429 rate limit error
 * - / - Root endpoint with available endpoints documentation
 *
 * POST endpoints:
 * - /echo - Echoes request data including body (supports JSON and text payloads)
 *
 * All endpoints return JSON responses unless specified otherwise.
 */

/* eslint-disable no-console */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { logger } from 'hono/logger';

const app = new Hono();
const args = process.argv.slice(2);
const portArg = args.find((arg) => arg.startsWith('--port='));
const PORT = portArg
  ? parseInt(portArg.split('=')[1], 10)
  : parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use('*', logger());
app.use('*', compress());

// Request tracking for metrics
let requestCount = 0;
const startTime = Date.now();

// Middleware to track requests
app.use('*', async (c, next) => {
  requestCount++;
  await next();
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    uptime: Date.now() - startTime,
    requests: requestCount,
    timestamp: new Date().toISOString(),
  });
});

// Status code endpoints
app.get('/status/:code', (c) => {
  const code = parseInt(c.req.param('code'), 10);

  if (isNaN(code) || code < 100 || code > 599) {
    return c.json(
      {
        error: 'Invalid status code',
        message: 'Status code must be between 100 and 599',
      },
      400,
    );
  }

  const statusMessages: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    410: 'Gone',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return c.json(
    {
      status: code,
      message: statusMessages[code] || 'Unknown Status',
      timestamp: new Date().toISOString(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code as any,
  );
});

// Convenience endpoints for common status codes
app.get('/success', (c) => c.json({ status: 'success', message: 'OK' }, 200));
app.get('/created', (c) =>
  c.json({ status: 'created', message: 'Resource created successfully' }, 201),
);
app.get('/accepted', (c) =>
  c.json(
    { status: 'accepted', message: 'Request accepted for processing' },
    202,
  ),
);
app.get('/bad-request', (c) =>
  c.json({ status: 'error', message: 'Bad Request' }, 400),
);
app.get('/unauthorized', (c) =>
  c.json({ status: 'error', message: 'Unauthorized' }, 401),
);
app.get('/forbidden', (c) =>
  c.json({ status: 'error', message: 'Forbidden' }, 403),
);
app.get('/not-found', (c) =>
  c.json({ status: 'error', message: 'Not Found' }, 404),
);
app.get('/server-error', (c) =>
  c.json({ status: 'error', message: 'Internal Server Error' }, 500),
);
app.get('/service-unavailable', (c) =>
  c.json({ status: 'error', message: 'Service Unavailable' }, 503),
);

// Delay endpoint
app.get('/delay/:ms', async (c) => {
  const delay = parseInt(c.req.param('ms'), 10);

  if (isNaN(delay) || delay < 0) {
    return c.json({ error: 'Invalid delay parameter' }, 400);
  }

  // Cap delay at 30 seconds to prevent abuse
  const actualDelay = Math.min(delay, 30000);

  await new Promise((resolve) => setTimeout(resolve, actualDelay));

  return c.json({
    status: 'success',
    delay: actualDelay,
    timestamp: new Date().toISOString(),
  });
});

// Timeout endpoint (never responds)
app.get('/timeout', (c) => {
  // Intentionally do not respond
  console.log(
    `Timeout request received from ${c.req.header('x-forwarded-for') || 'unknown'} - will not respond`,
  );
  // Return a promise that never resolves
  return new Promise(() => {});
});

// Chunked response endpoint
app.get('/chunked', () => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller): void {
      let counter = 0;
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`Chunk ${++counter}\n`));

        if (counter >= 5) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
    },
  });
});

// Random size response
app.get('/random-size', (c) => {
  const size = Math.floor(Math.random() * 10000) + 100; // 100-10100 bytes
  const data = 'a'.repeat(size);

  return c.json({
    size,
    data,
    timestamp: new Date().toISOString(),
  });
});

// Echo endpoints
app.get('/echo', (c) => {
  return c.json({
    method: c.req.method,
    url: c.req.url,
    headers: Object.fromEntries(
      c.req.raw.headers as unknown as Iterable<[string, string]>,
    ),
    query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
    timestamp: new Date().toISOString(),
  });
});

app.post('/echo', async (c) => {
  let body = null;
  try {
    body = await c.req.json();
  } catch {
    // If JSON parsing fails, try text
    try {
      body = await c.req.text();
    } catch {
      // If both fail, leave body as null
    }
  }

  return c.json({
    method: c.req.method,
    url: c.req.url,
    headers: Object.fromEntries(
      c.req.raw.headers as unknown as Iterable<[string, string]>,
    ),
    query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
    body,
    timestamp: new Date().toISOString(),
  });
});

// Redirect endpoints
app.get('/redirect/:code', (c) => {
  const code = parseInt(c.req.param('code'), 10);
  const url = c.req.query('url');

  if (!url) {
    return c.json(
      {
        error: 'Missing URL parameter',
        message:
          'Provide URL as query parameter: /redirect/301?url=https://example.com',
      },
      400,
    );
  }

  if (![301, 302, 303, 307, 308].includes(code)) {
    return c.json(
      {
        error: 'Invalid redirect code',
        message: 'Use 301, 302, 303, 307, or 308',
      },
      400,
    );
  }

  return c.redirect(url, code as 301 | 302 | 303 | 307 | 308);
});

// Payload endpoint
app.get('/payload/:size', (c) => {
  const sizeKB = parseInt(c.req.param('size'), 10);

  if (isNaN(sizeKB) || sizeKB < 1 || sizeKB > 100) {
    return c.json(
      {
        error: 'Invalid size',
        message: 'Size must be between 1 and 100 KB',
      },
      400,
    );
  }

  const data = 'a'.repeat(sizeKB * 1024);
  return c.json({
    size: sizeKB,
    unit: 'KB',
    data,
    timestamp: new Date().toISOString(),
  });
});

// Slow response endpoint
app.get('/slow-response', () => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller): Promise<void> {
      const totalParts = 10;
      let currentPart = 0;

      controller.enqueue(encoder.encode('{"status":"in_progress","parts":['));

      const interval = setInterval(() => {
        if (currentPart > 0) controller.enqueue(encoder.encode(','));
        controller.enqueue(
          encoder.encode(
            `{"part":${currentPart + 1},"data":"chunk${currentPart + 1}"}`,
          ),
        );

        currentPart++;

        if (currentPart >= totalParts) {
          clearInterval(interval);
          controller.enqueue(encoder.encode('],"complete":true}'));
          controller.close();
        }
      }, 500);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
});

// Rate limit simulation
app.get('/rate-limit', (c) => {
  const shouldLimit = Math.random() < 0.3; // 30% chance of rate limiting

  if (shouldLimit) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: 60,
        timestamp: new Date().toISOString(),
      },
      429,
    );
  } else {
    return c.json({
      status: 'success',
      message: 'Request allowed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Headers endpoint
app.get('/headers', (c) => {
  return c.json({
    headers: Object.fromEntries(
      c.req.raw.headers as unknown as Iterable<[string, string]>,
    ),
    ip:
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    protocol: new URL(c.req.url).protocol.replace(':', ''),
    hostname: c.req.header('host') || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// IP endpoint
app.get('/ip', (c) => {
  return c.json({
    ip:
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', (c) => {
  return c.json({
    uptime: Date.now() - startTime,
    requests: requestCount,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// Config endpoint
app.get('/config', (c) => {
  return c.json({
    port: PORT,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Tressi Test Server',
    version: '1.0.0',
    endpoints: {
      status: '/status/:code - Returns specified HTTP status code',
      success: '/success - 200 OK',
      created: '/created - 201 Created',
      accepted: '/accepted - 202 Accepted',
      badRequest: '/bad-request - 400 Bad Request',
      unauthorized: '/unauthorized - 401 Unauthorized',
      forbidden: '/forbidden - 403 Forbidden',
      notFound: '/not-found - 404 Not Found',
      serverError: '/server-error - 500 Internal Server Error',
      serviceUnavailable: '/service-unavailable - 503 Service Unavailable',
      delay: '/delay/:ms - Delayed response',
      timeout: '/timeout - Never responds',
      chunked: '/chunked - Chunked transfer encoding',
      randomSize: '/random-size - Random response size',
      echo: '/echo - Echoes request data',
      redirect: '/redirect/:code/:url - Redirect testing',
      payload: '/payload/:size - Returns response of specified size (KB)',
      slowResponse: '/slow-response - Slow incremental response',
      rateLimit: '/rate-limit - Simulates rate limiting',
      headers: '/headers - Returns request headers',
      ip: '/ip - Returns client IP',
      health: '/health - Health check',
      metrics: '/metrics - Basic metrics',
      config: '/config - Server configuration',
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 handler - must be last
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      availableEndpoints: [
        '/health',
        '/status/:code',
        '/success',
        '/created',
        '/accepted',
        '/bad-request',
        '/unauthorized',
        '/forbidden',
        '/not-found',
        '/server-error',
        '/service-unavailable',
        '/delay/:ms',
        '/timeout',
        '/chunked',
        '/random-size',
        '/echo',
        '/redirect/:code/:url',
        '/payload/:size',
        '/slow-response',
        '/rate-limit',
        '/headers',
        '/ip',
        '/metrics',
        '/config',
        '/',
      ],
      timestamp: new Date().toISOString(),
    },
    404,
  );
});

// Error handler
app.onError((err, c) => {
  console.error(err.stack);
  return c.json(
    {
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Something went wrong',
      timestamp: new Date().toISOString(),
    },
    500,
  );
});

// Start server
console.log(`🚀 Tressi Test Server starting at http://localhost:${PORT}`);
console.log('Available endpoints:');
console.log('  GET  /health - Health check');
console.log('  GET  /status/:code - Return specific status code');
console.log('  GET  /delay/:ms - Delayed response');
console.log('  GET  /timeout - Never responds (timeout testing)');
console.log('  GET  /echo - Echo request data');
console.log('  GET  /payload/:size - Return response of specified size (KB)');
console.log('  GET  /metrics - Server metrics');
console.log('  GET  / - This help message');
console.log('Press Ctrl+C to stop the server');

const server = serve({
  fetch: app.fetch,
  port: PORT as number,
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

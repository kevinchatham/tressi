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
 * - GET /error-50-percent - 50% chance of returning 500 error
 * - GET /chaos - List available chaos patterns
 * - GET /chaos/:pattern - Chaos injection patterns:
 *   - api-gateway: Simulates gateway with 3 downstream services (5% failure rate)
 *   - db-heavy: Simulates N+1 query problem with 10 sequential queries (2% failure rate)
 *   - connection-exhaustion: Connection pool with 5 max connections (30% failure when exhausted)
 * - GET / - Root endpoint with available endpoints documentation
 */
/** biome-ignore-all lint/suspicious/noConsole: default */
import { type ServerType, serve } from '@hono/node-server';
import { type OptionValues, program } from 'commander';
import { type Context, Hono } from 'hono';
import { compress } from 'hono/compress';
import { logger } from 'hono/logger';
import type { BlankEnv, BlankSchema } from 'hono/types';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

const app: Hono<BlankEnv, BlankSchema, '/'> = new Hono();

program
  .option('-p, --port <number>', 'Port to run the server on', (val) => Number.parseInt(val, 10))
  .option('-s, --silent', 'Disable logging', false)
  .parse(process.argv);

const options: OptionValues = program.opts();
const PORT: number = Number.parseInt(options.port || 5000, 10);
const SILENT = options.silent as boolean;

// Middleware
if (!SILENT) {
  app.use('*', logger());
}
app.use('*', compress());

// Request tracking for metrics
let requestCount = 0;
const startTime: number = Date.now();

function gaussianRandom(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function logNormalLatency(p50: number, p95: number): number {
  const mu = Math.log(p50);
  const sigma = (Math.log(p95) - Math.log(p50)) / 1.6449;
  return Math.floor(Math.exp(mu + sigma * gaussianRandom()));
}

// Middleware to track requests
app.use('*', async (_c, next) => {
  requestCount++;
  await next();
});

const activeConnections: Set<string> = new Set();
const MAX_CONNECTIONS = 5;

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    headers: Object.fromEntries(c.req.raw.headers),
    requests: requestCount,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  });
});

// Status code endpoints
app.get('/status/:code', (c) => {
  const code = Number.parseInt(c.req.param('code'), 10);

  if (Number.isNaN(code) || code < 100 || code > 599) {
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
      message: statusMessages[code] || 'Unknown Status',
      status: code,
      timestamp: new Date().toISOString(),
    },
    code as ContentfulStatusCode,
  );
});

// Convenience endpoints for common status codes
app.get('/success', (c) => c.json({ message: 'OK', status: 'success' }, 200));
app.get('/created', (c) =>
  c.json({ message: 'Resource created successfully', status: 'created' }, 201),
);
app.get('/accepted', (c) =>
  c.json({ message: 'Request accepted for processing', status: 'accepted' }, 202),
);
app.get('/bad-request', (c) => c.json({ message: 'Bad Request', status: 'error' }, 400));
app.get('/unauthorized', (c) => c.json({ message: 'Unauthorized', status: 'error' }, 401));
app.get('/forbidden', (c) => c.json({ message: 'Forbidden', status: 'error' }, 403));
app.get('/not-found', (c) => c.json({ message: 'Not Found', status: 'error' }, 404));
app.get('/server-error', (c) => c.json({ message: 'Internal Server Error', status: 'error' }, 500));
app.get('/service-unavailable', (c) =>
  c.json({ message: 'Service Unavailable', status: 'error' }, 503),
);

// Delay endpoint
app.get('/delay/:ms', async (c) => {
  const delay = Number.parseInt(c.req.param('ms'), 10);

  if (Number.isNaN(delay) || delay < 0) {
    return c.json({ error: 'Invalid delay parameter' }, 400);
  }

  // Cap delay at 30 seconds to prevent abuse
  const actualDelay = Math.min(delay, 30000);

  await new Promise((resolve) => setTimeout(resolve, actualDelay));

  return c.json({
    delay: actualDelay,
    status: 'success',
    timestamp: new Date().toISOString(),
  });
});

// Timeout endpoint (never responds)
app.get('/timeout', (c) => {
  // Intentionally do not respond
  if (!SILENT) {
    console.log(
      `Timeout request received from ${c.req.header('x-forwarded-for') || 'unknown'} - will not respond`,
    );
  }
  // Return a promise that never resolves
  return new Promise(() => {});
});

// Chunked response endpoint
app.get('/chunked', () => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller: ReadableStreamDefaultController<unknown>): void {
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
    data,
    size,
    timestamp: new Date().toISOString(),
  });
});

// Echo endpoints
app.get('/echo', (c) => {
  return c.json({
    headers: Object.fromEntries(c.req.raw.headers as unknown as Iterable<[string, string]>),
    method: c.req.method,
    query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
    timestamp: new Date().toISOString(),
    url: c.req.url,
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
    body,
    headers: Object.fromEntries(c.req.raw.headers as unknown as Iterable<[string, string]>),
    method: c.req.method,
    query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
    timestamp: new Date().toISOString(),
    url: c.req.url,
  });
});

// Redirect endpoints
app.get('/redirect/:code', (c) => {
  const code = Number.parseInt(c.req.param('code'), 10);
  const url = c.req.query('url');

  if (!url) {
    return c.json(
      {
        error: 'Missing URL parameter',
        message: 'Provide URL as query parameter: /redirect/301?url=https://example.com',
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
  const sizeKB = Number.parseInt(c.req.param('size'), 10);

  if (Number.isNaN(sizeKB) || sizeKB < 1 || sizeKB > 100) {
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
    data,
    size: sizeKB,
    timestamp: new Date().toISOString(),
    unit: 'KB',
  });
});

// Slow response endpoint
app.get('/slow-response', () => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController<unknown>): Promise<void> {
      const totalParts = 10;
      let currentPart = 0;

      controller.enqueue(encoder.encode('{"status":"in_progress","parts":['));

      const interval = setInterval(() => {
        if (currentPart > 0) controller.enqueue(encoder.encode(','));
        controller.enqueue(
          encoder.encode(`{"part":${currentPart + 1},"data":"chunk${currentPart + 1}"}`),
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
      message: 'Request allowed',
      status: 'success',
      timestamp: new Date().toISOString(),
    });
  }
});

// 50% error simulation
app.get('/error-50-percent', (c) => {
  const shouldError = Math.random() < 0.5;

  if (shouldError) {
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'This is a purposeful 50% chance error',
        timestamp: new Date().toISOString(),
      },
      500,
    );
  } else {
    return c.json({
      message: 'Request successful',
      status: 'success',
      timestamp: new Date().toISOString(),
    });
  }
});

async function handleApiGateway(c: Context): Promise<Response> {
  const start = Date.now();

  if (!SILENT) {
    console.log('Chaos: Simulating API gateway with 3 downstream services');
  }

  const downstreamLatencies = await Promise.all([
    new Promise<number>((resolve) => setTimeout(resolve, logNormalLatency(30, 100))),
    new Promise<number>((resolve) => setTimeout(resolve, logNormalLatency(50, 200))),
    new Promise<number>((resolve) => setTimeout(resolve, logNormalLatency(20, 80))),
  ]);

  const totalLatency = Date.now() - start;
  const shouldFail = Math.random() < 0.05;

  if (shouldFail) {
    return c.json(
      {
        downstreamLatencies,
        error: 'Gateway Timeout',
        message: 'One or more downstream services failed',
        timestamp: new Date().toISOString(),
        totalLatency,
      },
      504,
    );
  }

  return c.json({
    downstreamLatencies,
    message: 'Gateway request successful',
    services: ['users', 'products', 'orders'],
    status: 'success',
    timestamp: new Date().toISOString(),
    totalLatency,
  });
}

async function handleDbHeavy(c: Context): Promise<Response> {
  const start = Date.now();
  const queryCount = 10;
  const queryTimes: number[] = [];

  if (!SILENT) {
    console.log(`Chaos: Simulating N+1 query problem with ${queryCount} queries`);
  }

  for (let i = 0; i < queryCount; i++) {
    const queryStart = Date.now();
    await new Promise((resolve) => setTimeout(resolve, logNormalLatency(5, 15)));
    queryTimes.push(Date.now() - queryStart);
  }

  const totalLatency = Date.now() - start;
  const shouldFail = Math.random() < 0.02;

  if (shouldFail) {
    return c.json(
      {
        error: 'Database Connection Lost',
        message: 'Simulated DB failure',
        queryCount,
        queryTimes,
        timestamp: new Date().toISOString(),
        totalLatency,
      },
      503,
    );
  }

  return c.json({
    message: 'Database queries completed',
    queryCount,
    queryTimes,
    status: 'success',
    timestamp: new Date().toISOString(),
    totalLatency,
  });
}

async function handleConnectionExhaustion(c: Context): Promise<Response> {
  if (activeConnections.size >= MAX_CONNECTIONS) {
    if (!SILENT) {
      console.log('Chaos: Connection pool exhausted');
    }
    return c.json(
      {
        activeConnections: activeConnections.size,
        error: 'Connection pool exhausted',
        maxConnections: MAX_CONNECTIONS,
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }

  const connId = Math.random().toString(36).slice(2);
  activeConnections.add(connId);

  if (!SILENT) {
    console.log(`Chaos: Connection acquired (${activeConnections.size}/${MAX_CONNECTIONS})`);
  }

  const holdTime = 2000 + Math.random() * 3000;
  setTimeout(() => {
    activeConnections.delete(connId);
    if (!SILENT) {
      console.log(`Chaos: Connection released (${activeConnections.size}/${MAX_CONNECTIONS})`);
    }
  }, holdTime);

  return c.json({
    activeConnections: activeConnections.size,
    connectionId: connId,
    holdTime,
    maxConnections: MAX_CONNECTIONS,
    status: 'success',
    timestamp: new Date().toISOString(),
  });
}

app.get('/chaos', async (c) => {
  return c.json({
    availablePatterns: ['api-gateway', 'db-heavy', 'connection-exhaustion'],
    message: 'Specify a pattern: /chaos/:pattern',
  });
});

app.get('/chaos/:pattern', async (c) => {
  const pattern = c.req.param('pattern');

  switch (pattern) {
    case 'api-gateway':
      return handleApiGateway(c);
    case 'db-heavy':
      return handleDbHeavy(c);
    case 'connection-exhaustion':
      return handleConnectionExhaustion(c);
    default:
      return c.json(
        {
          availablePatterns: ['api-gateway', 'db-heavy', 'connection-exhaustion'],
          error: 'Unknown pattern',
        },
        400,
      );
  }
});

// Headers endpoint
app.get('/headers', (c) => {
  return c.json({
    headers: Object.fromEntries(c.req.raw.headers as unknown as Iterable<[string, string]>),
    hostname: c.req.header('host') || 'unknown',
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    protocol: new URL(c.req.url).protocol.replace(':', ''),
    timestamp: new Date().toISOString(),
  });
});

// IP endpoint
app.get('/ip', (c) => {
  return c.json({
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', (c) => {
  return c.json({
    memory: process.memoryUsage(),
    requests: requestCount,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  });
});

// Config endpoint
app.get('/config', (c) => {
  return c.json({
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    endpoints: {
      accepted: '/accepted - 202 Accepted',
      badRequest: '/bad-request - 400 Bad Request',
      chunked: '/chunked - Chunked transfer encoding',
      config: '/config - Server configuration',
      created: '/created - 201 Created',
      delay: '/delay/:ms - Delayed response',
      echo: '/echo - Echoes request data',
      error50Percent: '/error-50-percent - 50% chance of 500 error',
      forbidden: '/forbidden - 403 Forbidden',
      headers: '/headers - Returns request headers',
      health: '/health - Health check',
      ip: '/ip - Returns client IP',
      metrics: '/metrics - Basic metrics',
      notFound: '/not-found - 404 Not Found',
      payload: '/payload/:size - Returns response of specified size (KB)',
      randomSize: '/random-size - Random response size',
      rateLimit: '/rate-limit - Simulates rate limiting',
      redirect: '/redirect/:code?url= - Redirect testing',
      serverError: '/server-error - 500 Internal Server Error',
      serviceUnavailable: '/service-unavailable - 503 Service Unavailable',
      slowResponse: '/slow-response - Slow incremental response',
      status: '/status/:code - Returns specified HTTP status code',
      success: '/success - 200 OK',
      timeout: '/timeout - Never responds',
      unauthorized: '/unauthorized - 401 Unauthorized',
    },
    message: 'Tressi Test Server',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404 handler - must be last
app.notFound((c) => {
  return c.json(
    {
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
        '/redirect/:code?url=',
        '/payload/:size',
        '/slow-response',
        '/rate-limit',
        '/error-50-percent',
        '/headers',
        '/ip',
        '/metrics',
        '/config',
        '/',
      ],
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
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
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      timestamp: new Date().toISOString(),
    },
    500,
  );
});

console.log(`Tressi Test Server starting at http://localhost:${PORT}`);

if (!SILENT) {
  console.log('Available endpoints:');
  console.log('\n📊 Health & Metrics:');
  console.log('  GET  /health - Health check with uptime and request count');
  console.log('  GET  /metrics - Server metrics (uptime, requests, memory usage)');
  console.log('  GET  /config - Server configuration details');
  console.log('\n🔢 Status Code Testing:');
  console.log('  GET  /status/:code - Returns specified HTTP status code (100-599)');
  console.log('  GET  /success - 200 OK');
  console.log('  GET  /created - 201 Created');
  console.log('  GET  /accepted - 202 Accepted');
  console.log('  GET  /bad-request - 400 Bad Request');
  console.log('  GET  /unauthorized - 401 Unauthorized');
  console.log('  GET  /forbidden - 403 Forbidden');
  console.log('  GET  /not-found - 404 Not Found');
  console.log('  GET  /server-error - 500 Internal Server Error');
  console.log('  GET  /service-unavailable - 503 Service Unavailable');
  console.log('\n⏱️  Timing & Performance:');
  console.log('  GET  /delay/:ms - Delays response by specified milliseconds (max 30s)');
  console.log('  GET  /timeout - Never responds (for timeout testing)');
  console.log('  GET  /slow-response - Slow incremental JSON response over 5 seconds');
  console.log('  GET  /chunked - Chunked transfer encoding with 5 chunks over 5 seconds');
  console.log('\n📦 Response Size Testing:');
  console.log('  GET  /random-size - Returns random response size (100-10100 bytes)');
  console.log('  GET  /payload/:size - Returns response of specified size in KB (1-100 KB)');
  console.log('\n🔍 Request Inspection:');
  console.log('  GET  /echo - Echoes request data (method, URL, headers, query)');
  console.log('  POST /echo - Echoes request data including body');
  console.log('  GET  /headers - Returns request headers and client info');
  console.log('  GET  /ip - Returns client IP address');
  console.log('\n🔄 Redirect Testing:');
  console.log('  GET  /redirect/:code?url= - Redirects to specified URL with given status code');
  console.log('       Valid codes: 301, 302, 303, 307, 308');
  console.log('\n🚦 Miscellaneous:');
  console.log('  GET  /rate-limit - 30% chance of returning 429 rate limit error');
  console.log('  GET  /error-50-percent - 50% chance of returning 500 error');
  console.log('  GET  / - Root endpoint with available endpoints documentation');
  console.log('\nPress Ctrl+C to stop the server');
}

const server: ServerType = serve({
  fetch: app.fetch,
  port: PORT,
});

// Graceful shutdown
const shutdown = (): void => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

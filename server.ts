/* eslint-disable no-console */
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request tracking for metrics
let requestCount = 0;
const startTime = Date.now();

// Middleware to track requests
app.use((_req, _res, next) => {
  requestCount++;
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: Date.now() - startTime,
    requests: requestCount,
    timestamp: new Date().toISOString(),
  });
});

// Status code endpoints
app.get('/status/:code', (req, res) => {
  const code = parseInt(req.params.code, 10);

  if (isNaN(code) || code < 100 || code > 599) {
    return res.status(400).json({
      error: 'Invalid status code',
      message: 'Status code must be between 100 and 599',
    });
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

  res.status(code).json({
    status: code,
    message: statusMessages[code] || 'Unknown Status',
    timestamp: new Date().toISOString(),
  });
});

// Convenience endpoints for common status codes
app.get('/success', (_req, res) =>
  res.status(200).json({ status: 'success', message: 'OK' }),
);
app.get('/created', (_req, res) =>
  res
    .status(201)
    .json({ status: 'created', message: 'Resource created successfully' }),
);
app.get('/accepted', (_req, res) =>
  res
    .status(202)
    .json({ status: 'accepted', message: 'Request accepted for processing' }),
);
app.get('/bad-request', (_req, res) =>
  res.status(400).json({ status: 'error', message: 'Bad Request' }),
);
app.get('/unauthorized', (_req, res) =>
  res.status(401).json({ status: 'error', message: 'Unauthorized' }),
);
app.get('/forbidden', (_req, res) =>
  res.status(403).json({ status: 'error', message: 'Forbidden' }),
);
app.get('/not-found', (_req, res) =>
  res.status(404).json({ status: 'error', message: 'Not Found' }),
);
app.get('/server-error', (_req, res) =>
  res.status(500).json({ status: 'error', message: 'Internal Server Error' }),
);
app.get('/service-unavailable', (_req, res) =>
  res.status(503).json({ status: 'error', message: 'Service Unavailable' }),
);

// Delay endpoint
app.get('/delay/:ms', async (req, res) => {
  const delay = parseInt(req.params.ms, 10);

  if (isNaN(delay) || delay < 0) {
    return res.status(400).json({ error: 'Invalid delay parameter' });
  }

  // Cap delay at 30 seconds to prevent abuse
  const actualDelay = Math.min(delay, 30000);

  setTimeout(() => {
    res.json({
      status: 'success',
      delay: actualDelay,
      timestamp: new Date().toISOString(),
    });
  }, actualDelay);
});

// Timeout endpoint (never responds)
app.get('/timeout', (req) => {
  // Intentionally do not respond
  console.log(`Timeout request received from ${req.ip} - will not respond`);
});

// Chunked response endpoint
app.get('/chunked', (_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Transfer-Encoding': 'chunked',
  });

  let counter = 0;
  const interval = setInterval(() => {
    res.write(`Chunk ${++counter}\n`);

    if (counter >= 5) {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
});

// Random size response
app.get('/random-size', (_req, res) => {
  const size = Math.floor(Math.random() * 10000) + 100; // 100-10100 bytes
  const data = 'a'.repeat(size);

  res.json({
    size,
    data,
    timestamp: new Date().toISOString(),
  });
});

// Echo endpoints
app.get('/echo', (req, res) => {
  res.json({
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    timestamp: new Date().toISOString(),
  });
});

app.post('/echo', (req, res) => {
  res.json({
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body,
    timestamp: new Date().toISOString(),
  });
});

// Redirect endpoints
app.get('/redirect/:code', (req, res) => {
  const code = parseInt(req.params.code, 10);
  const url = req.query.url as string;

  if (!url) {
    return res.status(400).json({
      error: 'Missing URL parameter',
      message:
        'Provide URL as query parameter: /redirect/301?url=https://example.com',
    });
  }

  if (![301, 302, 303, 307, 308].includes(code)) {
    return res.status(400).json({
      error: 'Invalid redirect code',
      message: 'Use 301, 302, 303, 307, or 308',
    });
  }

  res.redirect(code, url);
});

// Payload endpoint
app.get('/payload/:size', (req, res) => {
  const sizeKB = parseInt(req.params.size, 10);

  if (isNaN(sizeKB) || sizeKB < 1 || sizeKB > 100) {
    return res.status(400).json({
      error: 'Invalid size',
      message: 'Size must be between 1 and 100 KB',
    });
  }

  const data = 'a'.repeat(sizeKB * 1024);
  res.json({
    size: sizeKB,
    unit: 'KB',
    data,
    timestamp: new Date().toISOString(),
  });
});

// Slow response endpoint
app.get('/slow-response', (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });

  const totalParts = 10;
  let currentPart = 0;

  res.write('{"status":"in_progress","parts":[');

  const interval = setInterval(() => {
    if (currentPart > 0) res.write(',');
    res.write(`{"part":${currentPart + 1},"data":"chunk${currentPart + 1}"}`);

    currentPart++;

    if (currentPart >= totalParts) {
      clearInterval(interval);
      res.end('],"complete":true}');
    }
  }, 500);
});

// Rate limit simulation
app.get('/rate-limit', (_req, res) => {
  const shouldLimit = Math.random() < 0.3; // 30% chance of rate limiting

  if (shouldLimit) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: 60,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.json({
      status: 'success',
      message: 'Request allowed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Headers endpoint
app.get('/headers', (req, res) => {
  res.json({
    headers: req.headers,
    ip: req.ip,
    ips: req.ips,
    protocol: req.protocol,
    hostname: req.hostname,
    timestamp: new Date().toISOString(),
  });
});

// IP endpoint
app.get('/ip', (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips,
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', (_req, res) => {
  res.json({
    uptime: Date.now() - startTime,
    requests: requestCount,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// Config endpoint
app.get('/config', (_req, res) => {
  res.json({
    port: PORT,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
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
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Tressi Test Server running at http://localhost:${PORT}`);
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
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

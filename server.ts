/* eslint-disable no-console */
import { createServer } from 'http';

const PORT = 3000;

const server = createServer((req, res) => {
  // Handle GET requests to "/"
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify({ status: 'success' }));
  } else if (req.method === 'POST' && req.url === '/') {
    // Handle POST requests to "/"
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      let parsedBody;
      try {
        parsedBody = body ? JSON.parse(body) : {};
      } catch {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end(
          JSON.stringify({
            error: 'Bad Request',
            message: 'Invalid JSON in request body',
          }),
        );
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end(
        JSON.stringify({
          status: 'success',
          method: 'POST',
          received: parsedBody,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  } else {
    // Handle all other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Not Found',
        message: 'The requested resource was not found',
        timestamp: new Date().toISOString(),
      }),
    );
  }
});

server.listen(PORT, () => {
  console.log(`🚀 TypeScript HTTP server running at http://localhost:${PORT}`);
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

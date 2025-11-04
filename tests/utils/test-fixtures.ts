import { createServer } from 'http';
import { createServer as createNetServer } from 'net';

export interface TestServer {
  port: number;
  kill: (signal?: NodeJS.Signals) => boolean;
}

export async function startTestServer(port: number = 0): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost:' + port);

      // Health check endpoint
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      // Success endpoint
      if (url.pathname === '/success') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'success' }));
        return;
      }

      // Server error endpoint
      if (url.pathname === '/server-error') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
        return;
      }

      // Not found endpoint
      if (url.pathname === '/not-found') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      // Delay endpoint
      if (url.pathname.startsWith('/delay/')) {
        const delay = parseInt(url.pathname.split('/')[2]) || 1000;
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ delay }));
        }, delay);
        return;
      }

      // Timeout endpoint
      if (url.pathname === '/timeout') {
        // Never respond
        return;
      }

      // Chunked transfer endpoint
      if (url.pathname === '/chunked') {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked',
        });

        let chunks = 0;
        const interval = setInterval(() => {
          if (chunks >= 5) {
            clearInterval(interval);
            res.end();
            return;
          }
          res.write('chunk-' + chunks + '\n');
          chunks++;
        }, 100);
        return;
      }

      // Redirect endpoint
      if (url.pathname.startsWith('/redirect/')) {
        const code = parseInt(url.pathname.split('/')[2]) || 301;
        const target = url.searchParams.get('url') || '/success';
        res.writeHead(code, { Location: target });
        res.end();
        return;
      }

      // Rate limit endpoint
      if (url.pathname === '/rate-limit') {
        const count = parseInt(url.searchParams.get('count') || '10');
        const window = parseInt(url.searchParams.get('window') || '1000');

        // Simple rate limiting simulation
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            limit: count,
            remaining: Math.max(0, count - 1),
            reset: Date.now() + window,
          }),
        );
        return;
      }

      // Headers endpoint
      if (url.pathname === '/headers') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test-value',
        });
        res.end(
          JSON.stringify({
            headers: req.headers,
            method: req.method,
          }),
        );
        return;
      }

      // Default response
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    });

    server.listen(port, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve({
          port: address.port,
          kill: () => {
            server.close();
            return true;
          },
        });
      } else {
        reject(new Error('Failed to get server address'));
      }
    });

    server.on('error', reject);
  });
}

export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close();
        reject(new Error('Failed to get available port'));
      }
    });
    server.on('error', reject);
  });
}

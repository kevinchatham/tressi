import { serve } from '@hono/node-server';
import { Hono } from 'hono';

/**
 * TressiServer - A simple Hono server for the tressi serve command
 */
export class TressiServer {
  private app: Hono;
  private server: ReturnType<typeof serve> | null = null;
  private port: number;

  constructor(port: number = 3108) {
    this.port = port;
    this.app = new Hono();
    this.setupRoutes();
  }

  /**
   * Sets up the server routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        service: 'tressi-server',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Root endpoint
    this.app.get('/', (c) => {
      return c.json({
        message: 'Tressi Server is running',
        version: '1.0.0',
        endpoints: {
          health: '/health',
        },
      });
    });
  }

  /**
   * Starts the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = serve({
          fetch: this.app.fetch,
          port: this.port,
        });

        this.server.on('listening', () => {
          // eslint-disable-next-line no-console
          console.log(
            `🚀 Tressi server is running on http://localhost:${this.port}`,
          );
          // eslint-disable-next-line no-console
          console.log(
            `📊 Health check available at http://localhost:${this.port}/health`,
          );
          resolve();
        });

        this.server.on('error', (error) => {
          reject(error as Error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stops the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          // eslint-disable-next-line no-console
          console.log('🛑 Tressi server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

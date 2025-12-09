import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { terminal } from '../tui/terminal';
import createApp from './routes';
import { SSEManager } from './utils/sse-manager';

export class TressiServer {
  private app: Hono;
  private server: ReturnType<typeof serve> | null = null;
  private port: number;
  private sseManager: SSEManager;

  constructor(port: number = 3108) {
    this.port = port;
    this.sseManager = new SSEManager();
    this.app = createApp(this.sseManager, port);
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = serve({
          fetch: this.app.fetch,
          port: this.port,
        });
        this.server.on('listening', () => {
          terminal.print(
            `🚀 Tressi server is running on http://localhost:${this.port}`,
          );
          terminal.print(
            `📊 Health check available at http://localhost:${this.port}/api/health`,
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

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.sseManager.cleanup();
          terminal.print('\n🛑 Tressi server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

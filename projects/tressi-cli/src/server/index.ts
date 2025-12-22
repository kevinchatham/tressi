import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { ServerEvents } from '../events/event-types';
import { terminal } from '../tui/terminal';
import createApp from './routes';
import { SSEManager } from './utils/sse-manager';

export class TressiServer {
  private app: Hono;
  private server: ReturnType<typeof serve> | null = null;
  private port: number;
  private sseManager: SSEManager;
  private heartbeatInterval: NodeJS.Timeout | null = null;

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
          this.startHeartbeat();
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
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.server) {
        // Force close all SSE connections first
        this.sseManager.forceClose();

        // Set a timeout to force exit if graceful shutdown takes too long
        const timeout = setTimeout(() => {
          process.exit(0);
        }, 500);

        this.server.close(() => {
          clearTimeout(timeout);
          this.sseManager.cleanup();
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Starts the heartbeat interval for sending regular connected events
   * @private
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const message = {
        event: ServerEvents.CONNECTED,
        data: {
          timestamp: Date.now(),
        },
      };
      this.sseManager.broadcast(message);
    }, 1000); // Send heartbeat every 1 second
  }
}

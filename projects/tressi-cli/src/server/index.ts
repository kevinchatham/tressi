import { serve } from '@hono/node-server';
import chalk from 'chalk';
import { Hono } from 'hono';
import { homedir } from 'os';
import { join } from 'path';

import pkg from '../../../../package.json';
import { testStorage } from '../collections/test-collection';
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
    // Clean up any tests left in 'running' state from previous session
    try {
      const stoppedCount = await testStorage.stopAllRunningTests();
      if (stoppedCount > 0) {
        terminal.print(
          `🧹 Cleaned up ${stoppedCount} test(s) that were left running.`,
        );
      }
    } catch (error) {
      terminal.print(
        `⚠️ Warning: Failed to clean up running tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = serve({
          fetch: this.app.fetch,
          port: this.port,
        });
        this.server.on('listening', () => {
          const url = `http://localhost:${this.port}`;
          const dbPath = join(homedir(), '.tressi', 'tressi.db');

          terminal.print('');
          terminal.print(
            `  ${chalk.yellow.bold('⚡')} ${chalk.bold(`Tressi ${pkg.version}`)}`,
          );
          terminal.print('');
          terminal.print(`  ${chalk.bold('Local:')} ${chalk.cyan(url)}`);
          terminal.print(`  ${chalk.bold('Store:')} ${chalk.magenta(dbPath)}`);
          terminal.print('');
          terminal.print(
            `  ${chalk.dim('Press')} ${chalk.bold.dim('Ctrl+C')} ${chalk.dim('to stop the server')}`,
          );
          terminal.print('');

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

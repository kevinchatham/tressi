import { homedir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { ServerEvents } from '@tressi/shared/common';
import chalk from 'chalk';
import type { Hono } from 'hono';

import pkg from '../../../../package.json';
import { testStorage } from '../collections/test-collection';
import { terminal } from '../tui/terminal';
import createApp from './routes';
import { SSEManager } from './utils/sse-manager';

export class TressiServer {
  private readonly _app: Hono;
  private _server: ReturnType<typeof serve> | null = null;
  private readonly _port: number;
  private readonly _sseManager: SSEManager;
  private _heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3108) {
    this._port = port;
    this._sseManager = new SSEManager();
    this._app = createApp(this._sseManager, port);
  }

  async start(): Promise<void> {
    // Clean up any tests left in 'running' state from previous session
    try {
      const stoppedCount = await testStorage.stopAllRunningTests();
      if (stoppedCount > 0) {
        terminal.print(`🧹 Cleaned up ${stoppedCount} test(s) that were left running.`);
      }
    } catch (error) {
      terminal.print(
        `⚠️ Warning: Failed to clean up running tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return new Promise((resolve, reject) => {
      try {
        this._server = serve({
          fetch: this._app.fetch,
          port: this._port,
        });
        this._server.on('listening', () => {
          const url = `http://localhost:${this._port}`;
          const dbPath = process.env['TRESSI_DB_PATH'] || join(homedir(), '.tressi', 'tressi.db');

          terminal.print('');
          const versionText = `Tressi v${pkg.version}`;
          terminal.print(`  ${chalk.yellow.bold('⚡')} ${chalk.bold(versionText)}`);
          terminal.print('');
          terminal.print(`  ${chalk.bold('Local:')} ${chalk.cyan(url)}`);
          terminal.print(`  ${chalk.bold('Store:')} ${chalk.magenta(dbPath)}`);
          terminal.print('');
          terminal.print(
            `  ${chalk.dim('Press')} ${chalk.bold.dim('Ctrl+C')} ${chalk.dim('to stop the server')}`,
          );
          terminal.print('');

          this._startHeartbeat();
          resolve();
        });
        this._server.on('error', (error) => {
          reject(error as Error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this._heartbeatInterval) {
        clearInterval(this._heartbeatInterval);
        this._heartbeatInterval = null;
      }

      if (this._server) {
        // Force close all SSE connections first
        this._sseManager.forceClose();

        // Set a timeout to force exit if graceful shutdown takes too long
        const timeout = setTimeout(() => {
          process.exit(0);
        }, 500);

        this._server.close(() => {
          clearTimeout(timeout);
          this._sseManager.cleanup();
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
  private _startHeartbeat(): void {
    this._heartbeatInterval = setInterval(() => {
      const message = {
        data: {
          timestamp: Date.now(),
        },
        event: ServerEvents.CONNECTED,
      };
      this._sseManager.broadcast(message);
    }, 1000); // Send heartbeat every 1 second
  }
}

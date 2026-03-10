import type { ChildProcess } from 'child_process';
import fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import kill from 'tree-kill';

import { execute, killPort } from '../utils';

export class CliServerManager {
  private _process: ChildProcess | null = null;
  constructor(private readonly _port: number = 8000) {}

  async start(): Promise<string> {
    const cliDir = path.resolve(__dirname, '../../../dist');
    const baseURL = `http://localhost:${this._port}`;
    const dbPath = path.resolve(__dirname, '../tressi.test.db');

    if (fs.existsSync(dbPath)) {
      // eslint-disable-next-line no-console
      console.log(`Resetting ${dbPath}`);
      fs.rmSync(dbPath);
    }

    // eslint-disable-next-line no-console
    console.log(`Starting Tressi CLI server on port ${this._port}...`);

    // Ensure the port is clean before starting
    killPort(this._port);

    this._process = execute('node', {
      args: ['cli.js', 'serve', '--port', this._port.toString()],
      env: {
        ...process.env,
        TRESSI_DB_PATH: dbPath,
      },
      stdio: 'pipe',
      cwd: cliDir,
    });

    await this._waitForReady(baseURL);
    return baseURL;
  }

  async stop(): Promise<void> {
    if (this._process && this._process.pid) {
      // eslint-disable-next-line no-console
      console.log('Stopping Tressi CLI server...');
      const pid = this._process.pid;
      await new Promise<void>((resolve) => {
        kill(pid, 'SIGTERM', () => {
          this._process = null;
          resolve();
        });
      });
    }
  }

  private async _checkHealth(baseURL: string): Promise<boolean> {
    return new Promise((resolve) => {
      const url = `${baseURL}/api/health`;
      const req = http.get(url, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(500, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private async _waitForReady(baseURL: string): Promise<void> {
    const maxAttempts = 30;
    const interval = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (await this._checkHealth(baseURL)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error('Tressi CLI server startup timeout');
  }
}

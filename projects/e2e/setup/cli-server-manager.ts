import type { ChildProcess } from 'child_process';
import * as http from 'http';
import * as path from 'path';

import { execute } from '../utils';

export class CliServerManager {
  private _process: ChildProcess | null = null;
  private _port: number;

  constructor(port = 8888) {
    this._port = port;
  }

  async start(): Promise<string> {
    const cliDir = path.resolve(__dirname, '../../cli');
    const baseURL = `http://localhost:${this._port}`;

    // Check if server is already running
    const isRunning = await this._checkHealth(baseURL);
    if (isRunning) {
      // eslint-disable-next-line no-console
      console.log('Tressi CLI server already running, reusing...');
      return baseURL;
    }

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line no-console
      console.log(`Starting Tressi CLI server on port ${this._port}...`);

      this._process = execute('npm', {
        args: ['run', 'serve', '--', '--port', this._port.toString()],
        stdio: 'pipe',
        cwd: cliDir,
      });

      this._waitForReady(baseURL)
        .then(() => resolve(baseURL))
        .catch(reject);
    });
  }

  async stop(): Promise<void> {
    if (this._process) {
      // eslint-disable-next-line no-console
      console.log('Stopping Tressi CLI server...');
      this._process.kill();
      this._process = null;
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

import type { ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import kill from 'tree-kill';

import { execute, killPort } from '../utils';

export class TestServerManager {
  private _process: ChildProcess | null = null;

  constructor(private readonly _port: number = 8001) {}

  async start(): Promise<string> {
    const baseURL = `http://localhost:${this._port}`;

    // Ensure the port is clean before starting
    killPort(this._port);

    this._process = execute('npx', {
      args: ['tsx', path.join(__dirname, './test-server.ts'), `--port=${this._port}`, '--silent'],
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    await this._waitForReady();
    return baseURL;
  }

  async stop(): Promise<void> {
    if (this._process?.pid) {
      const pid = this._process.pid;
      await new Promise<void>((resolve) => {
        kill(pid, 'SIGTERM', () => {
          this._process = null;
          resolve();
        });
      });
    }
  }

  private async _waitForReady(): Promise<void> {
    const maxAttempts = 30;
    const interval = 500;
    const healthUrl = `http://localhost:${this._port}/health`;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(healthUrl);
        if (response.ok) return;
      } catch {
        // Server not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error('Server startup timeout');
  }
}

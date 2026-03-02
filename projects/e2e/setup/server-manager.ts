import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import * as net from 'net';
import * as path from 'path';

export class ServerManager {
  private _process: ChildProcess | null = null;
  private _port = 0;

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        this._port = (server.address() as { port: number }).port;
        server.close(() => {
          this._process = spawn(
            'npx',
            [
              'tsx',
              path.join(__dirname, './test-server.ts'),
              `--port=${this._port}`,
            ],
            {
              stdio: 'pipe',
              cwd: process.cwd(),
            },
          );

          this._waitForReady()
            .then(() => resolve(`http://localhost:${this._port}`))
            .catch(reject);
        });
      });
    });
  }

  async stop(): Promise<void> {
    if (this._process) {
      this._process.kill();
      this._process = null;
    }
  }

  private async _waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Server startup timeout')),
        10000,
      );

      this._process?.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('starting at')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      // Also listen for stderr in case there are startup issues
      this._process?.stderr?.on('data', (data: Buffer) => {
        // eslint-disable-next-line no-console
        console.error('Server stderr:', data.toString());
      });
    });
  }
}

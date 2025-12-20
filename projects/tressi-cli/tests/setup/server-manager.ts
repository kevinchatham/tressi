import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import * as net from 'net';
import * as path from 'path';

export class ServerManager {
  private process: ChildProcess | null = null;
  private port = 0;

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        this.port = (server.address() as { port: number }).port;
        server.close(() => {
          this.process = spawn(
            'npx',
            ['tsx', path.join(__dirname, './server.ts'), `--port=${this.port}`],
            {
              stdio: 'pipe',
              cwd: process.cwd(),
            },
          );

          this.waitForReady()
            .then(() => resolve(`http://localhost:${this.port}`))
            .catch(reject);
        });
      });
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Server startup timeout')),
        10000,
      );

      this.process?.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('starting at')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      // Also listen for stderr in case there are startup issues
      this.process?.stderr?.on('data', (data: Buffer) => {
        console.error('Server stderr:', data.toString());
      });
    });
  }
}

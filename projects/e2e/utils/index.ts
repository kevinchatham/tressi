import {
  ChildProcess,
  execSync,
  ExecSyncOptions,
  spawn,
  SpawnOptions,
} from 'child_process';
import path from 'path';

/**
 * Gets a sanitized PATH that ensures Linux/WSL environment tools are prioritized.
 */
export function getSanitizedPath(): string {
  // Get the directory of the currently running Node executable (e.g., from nvm)
  const nodeBinDir = path.dirname(process.execPath);

  // Sanitize the PATH:
  // 1. Put the current Node's bin directory first
  // 2. Filter out Windows-specific paths that might contain .exe or .cmd files
  return [
    nodeBinDir,
    ...(process.env.PATH || '')
      .split(':')
      .filter((p) => !p.startsWith('/mnt/c/') && !p.includes('Windows')),
  ].join(':');
}

/**
 * Runs a shell command with a sanitized PATH to ensure it uses the Linux/WSL environment.
 * This prevents "leaks" where Windows executables (like npm.cmd) are accidentally called.
 */
const rootDir = path.resolve(__dirname, '../../../');
const defaultTestDbPath = path.join(rootDir, 'projects/e2e/tressi.test.db');

export function run(
  command: string,
  options: ExecSyncOptions = {},
): string | Buffer {
  return execSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options,
    env: {
      ...process.env,
      TRESSI_DB_PATH: defaultTestDbPath,
      ...options.env,
      PATH: getSanitizedPath(),
    },
  });
}

export interface ExecuteOptions extends SpawnOptions {
  /** Arguments for the command (if not using shell mode) */
  args?: string[];
}

/**
 * Unified process execution utility.
 * Returns a ChildProcess with an additional 'promise' property for async/await.
 */
export function execute(
  command: string,
  options: ExecuteOptions = {},
): ChildProcess & { output: Promise<string> } {
  const { args = [], ...spawnOptions } = options;

  const child = spawn(command, args, {
    cwd: rootDir,
    shell: args.length === 0,
    ...spawnOptions,
    env: {
      ...process.env,
      TRESSI_DB_PATH: defaultTestDbPath,
      ...spawnOptions.env,
      PATH: getSanitizedPath(),
    },
  }) as ChildProcess & { output: Promise<string> };

  child.output = new Promise((resolve, reject) => {
    let output = '';
    const handleData = (data: Buffer): void => {
      output += data;
      process.stdout.write(data);
    };

    child.stdout?.on('data', handleData);
    child.stderr?.on('data', (data) => process.stderr.write(data));

    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`Command failed with code ${code}\n${output}`)),
    );
    child.on('error', reject);
  });

  return child;
}

/**
 * Kills any process listening on the specified port.
 * Useful for cleaning up orphaned test servers.
 */
export function killPort(port: number): void {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
  } catch {}
}

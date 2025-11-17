import { existsSync } from 'fs';
import path from 'path';

/**
 * Determines the correct path to the worker thread file based on the runtime environment.
 *
 * When running in development with tsx, uses the TypeScript source file.
 * When running the built version, uses the compiled JavaScript file.
 */
export function getWorkerThreadPath(): string {
  // Get the current directory of this file
  const currentDir = __dirname;

  // Check if we're running from the src directory (development mode)
  const isInSrc = currentDir.endsWith('src') || currentDir.endsWith('src/');

  if (isInSrc) {
    // When running with tsx from src directory
    const tsPath = path.resolve(currentDir, 'workers/worker-thread.ts');
    if (existsSync(tsPath)) {
      return tsPath;
    }
  }

  // Check if we're running from dist directory
  const isInDist = currentDir.endsWith('dist') || currentDir.endsWith('dist/');
  if (isInDist) {
    // When running from dist directory
    const jsPath = path.resolve(currentDir, 'workers/worker-thread.js');
    if (existsSync(jsPath)) {
      return jsPath;
    }
  }

  // Check for development mode from utils directory
  const isInUtils =
    currentDir.endsWith('utils') || currentDir.endsWith('utils/');
  if (isInUtils) {
    const tsPath = path.resolve(currentDir, '../workers/worker-thread.ts');
    if (existsSync(tsPath)) {
      return tsPath;
    }
  }

  // Check for built version from utils directory
  if (isInUtils) {
    const jsPath = path.resolve(currentDir, '../workers/worker-thread.js');
    if (existsSync(jsPath)) {
      return jsPath;
    }
  }

  // Fallback to absolute paths
  const projectRoot = path.resolve(__dirname, '..');
  const srcPath = path.resolve(projectRoot, 'src/workers/worker-thread.ts');
  const distPath = path.resolve(projectRoot, 'dist/workers/worker-thread.js');

  if (existsSync(srcPath)) {
    return srcPath;
  }

  if (existsSync(distPath)) {
    return distPath;
  }

  // Final fallback
  return './dist/workers/worker-thread.js';
}

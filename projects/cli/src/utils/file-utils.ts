import { existsSync, promises as fs } from 'fs';
import path from 'path';

/**
 * File system utility functions.
 */
export class FileUtils {
  /**
   * Ensures a directory exists, creating it if necessary.
   * @param dirPath Path to the directory
   */
  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Generates a safe directory name that is compatible with Windows, macOS, and Linux file systems.
   *
   * This function sanitizes input strings to ensure they can be used as directory names
   * across all major operating systems by removing or replacing invalid characters
   * and handling reserved names. Path separators (forward slashes and backslashes)
   * are preserved in the output as they may be part of nested directory structures.
   *
   * @param input - The input string to convert to a safe directory name
   * @returns A safe directory name compatible with Windows, macOS, and Linux
   *
   * @example
   * // Basic usage
   * getSafeDirectoryName("My Project v1.0")
   * // Returns: "My_Project_v1_0"
   *
   * @example
   * // Handling special characters while preserving path separators
   * getSafeDirectoryName("folder/subfolder:name:with:colons")
   * // Returns: "folder/subfolder-name-with-colons"
   *
   * @example
   * // Handling Windows reserved names
   * getSafeDirectoryName("CON")
   * // Returns: "_CON"
   *
   * @example
   * // Handling leading/trailing spaces and dots
   * getSafeDirectoryName("  spaced folder  ")
   * // Returns: "spaced_folder"
   *
   * @example
   * // Preserving path separators in nested structures
   * getSafeDirectoryName("path/to/folder:with:colons")
   * // Returns: "path/to/folder-with-colons"
   */
  static getSafeDirectoryName(input: string): string {
    if (!input || typeof input !== 'string') {
      return '_unnamed';
    }

    // Windows reserved names (case-insensitive)
    const windowsReserved = [
      'CON',
      'PRN',
      'AUX',
      'NUL',
      'COM1',
      'COM2',
      'COM3',
      'COM4',
      'COM5',
      'COM6',
      'COM7',
      'COM8',
      'COM9',
      'LPT1',
      'LPT2',
      'LPT3',
      'LPT4',
      'LPT5',
      'LPT6',
      'LPT7',
      'LPT8',
      'LPT9',
    ];

    // Characters invalid on Windows: < > : " | ? * \
    // Characters invalid on macOS/Linux: /
    // Additional problematic characters: \0 (null)
    let safeName = input
      // Remove or replace invalid characters
      .replace(/[<>:"|?*\x00-\x1f]/g, '-') // Windows invalid chars and control chars
      .replace(/:/g, '-') // Colons (mainly for Windows)

      // Trim leading/trailing spaces and dots
      .trim()
      .replace(/^\.+|\.+$/g, '')

      // Replace multiple spaces/dashes with single underscore
      .replace(/[\s-]+/g, '_')

      // Replace multiple underscores with single underscore
      .replace(/_+/g, '_')

      // Remove any remaining invalid characters
      .replace(/[^a-zA-Z0-9._\-\/\\]/g, '_');

    // Handle empty result
    if (!safeName) {
      return '_unnamed';
    }

    // Check if it's a Windows reserved name
    const upperName = safeName.toUpperCase();
    if (windowsReserved.includes(upperName)) {
      safeName = '_' + safeName;
    }

    // Ensure it doesn't end with a dot or space (Windows issue)
    safeName = safeName.replace(/[. ]+$/, '');

    // Handle names that are too long (Windows has 260 character limit, but we'll be more conservative)
    if (safeName.length > 200) {
      safeName = safeName.substring(0, 200);
    }

    // Ensure we still have a valid name after truncation
    if (!safeName || safeName === '_' || safeName === '-') {
      return '_unnamed';
    }

    return safeName;
  }

  /**
   * Determines the correct path to the worker thread file based on the runtime environment.
   *
   * When running in development with tsx, uses the TypeScript source file.
   * When running the built version, uses the compiled JavaScript file.
   */
  static getWorkerThreadPath(): string {
    // Get the current directory of this file
    const currentDir = __dirname;

    // Find the project root (projects/cli) by looking for src or dist in the path
    // This handles cases where this file is in a subdirectory like src/utils
    let projectRoot = currentDir;
    if (currentDir.includes('/src')) {
      projectRoot = currentDir.split('/src')[0];
    } else if (currentDir.includes('/dist')) {
      projectRoot = currentDir.split('/dist')[0];
    } else {
      // Fallback to one level up if we can't find src or dist
      projectRoot = path.resolve(currentDir, '..');
    }

    // Try absolute paths first to avoid CWD dependency
    const srcPath = path.resolve(projectRoot, 'src/workers/worker-thread.ts');
    const distPath = path.resolve(projectRoot, 'dist/workers/worker-thread.js');

    // 1. Check for dist version (production)
    // We prefer the compiled version if it exists, as it's more reliable across different environments
    // (especially in worker threads where TS loaders might not be present)
    if (existsSync(distPath)) {
      return distPath;
    }

    // 2. Check for source version (development)
    if (existsSync(srcPath)) {
      return srcPath;
    }

    // 3. Fallback for bundled environments where __dirname might be the dist root
    const bundledPath = path.resolve(currentDir, 'workers/worker-thread.js');
    if (existsSync(bundledPath)) {
      return bundledPath;
    }

    // Final fallback - still use absolute path if possible
    return distPath;
  }
}

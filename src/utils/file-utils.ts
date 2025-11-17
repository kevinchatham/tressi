import { promises as fs } from 'fs';
import * as path from 'path';

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
   * Joins multiple path segments together.
   * @param paths Path segments to join
   * @returns Joined path
   */
  static joinPath(...paths: string[]): string {
    return path.join(...paths);
  }
}

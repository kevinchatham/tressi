import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * File system utility functions.
 */
export class FileUtils {
  /**
   * Checks if a file exists at the given path.
   * @param filePath Path to the file
   * @returns Promise that resolves to true if file exists, false otherwise
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Reads a JSON file and parses its contents.
   * @param filePath Path to the JSON file
   * @returns Promise that resolves to the parsed JSON object
   */
  static async readJsonFile<T = unknown>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * Writes an object to a JSON file with proper formatting.
   * @param filePath Path to the output file
   * @param data Object to write
   * @param indent JSON indentation (default: 2)
   */
  static async writeJsonFile(
    filePath: string,
    data: unknown,
    indent: number = 2,
  ): Promise<void> {
    await this.ensureDirectoryExists(path.dirname(filePath));
    const content = JSON.stringify(data, null, indent);
    await fs.writeFile(filePath, content, 'utf-8');
  }

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
   * Gets the absolute path for a file.
   * @param filePath Path to resolve
   * @returns Absolute path
   */
  static getAbsolutePath(filePath: string): string {
    return path.resolve(filePath);
  }

  /**
   * Gets the file extension from a path.
   * @param filePath Path to the file
   * @returns File extension (including the dot) or empty string if no extension
   */
  static getFileExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Gets the filename without extension from a path.
   * @param filePath Path to the file
   * @returns Filename without extension
   */
  static getFileNameWithoutExtension(filePath: string): string {
    const basename = path.basename(filePath);
    const ext = path.extname(basename);
    return basename.slice(0, -ext.length) || basename;
  }

  /**
   * Joins multiple path segments together.
   * @param paths Path segments to join
   * @returns Joined path
   */
  static joinPath(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Gets the directory name from a file path.
   * @param filePath Path to the file
   * @returns Directory name
   */
  static getDirectoryName(filePath: string): string {
    return path.dirname(filePath);
  }
}

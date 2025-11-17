import { promises as fs } from 'fs';
import path from 'path';

import { generateFullConfig, generateMinimalConfig } from '../core/config';

/**
 * Handles the 'init' command for creating Tressi configuration files.
 */
export class InitCommand {
  /**
   * Executes the init command.
   * @param options Command options
   * @param options.full Generate full configuration with all options
   * @returns Promise that resolves when the command completes
   * @throws Error when config file creation fails
   */
  async execute(options: { full?: boolean }): Promise<void> {
    const fileName = `tressi.config.json`;
    const filePath = path.resolve(process.cwd(), fileName);

    try {
      await fs.access(filePath);
      // File already exists, skip creation
      return;
    } catch {
      try {
        const config = options.full
          ? generateFullConfig()
          : generateMinimalConfig();
        await fs.writeFile(filePath, JSON.stringify(config, null, 2));
      } catch (err) {
        throw new Error(
          `Failed to create config file: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return `Create a tressi configuration file to define your load testing scenarios.

This command generates a JSON configuration file that specifies:
- Target URLs and endpoints to test
- Request methods, headers, and payloads
- Load patterns (concurrent users, duration, ramp-up)
- Performance thresholds and success criteria
- Output formats and reporting options

By default, a minimal configuration is created with essential settings for quick start. Use --full to generate a comprehensive configuration with all available options, including advanced features like custom distributions, detailed assertions, and multiple test phases.

After creation, edit the configuration file to match your API testing requirements, then run 'tressi' to execute your load tests.`;
  }
}

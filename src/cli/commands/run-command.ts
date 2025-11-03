import { promises as fs } from 'fs';
import path from 'path';

import { runLoadTest } from '../..';
import { loadConfig } from '../../config';

/**
 * Handles the main 'run' command for executing load tests.
 */
export class RunCommand {
  /**
   * Executes the run command.
   * @param configPath Optional path to configuration file
   * @returns Promise that resolves when the command completes
   * @throws Error when config loading or test execution fails
   */
  async execute(configPath?: string): Promise<void> {
    const resolvedConfigPath = await this.resolveConfigPath(configPath);
    const config = await loadConfig(resolvedConfigPath);
    await runLoadTest(config);
  }

  /**
   * Resolves the configuration file path.
   * @param configPath Optional configuration path provided by user
   * @returns Resolved configuration path
   * @throws Error when default config file is not found
   */
  private async resolveConfigPath(configPath?: string): Promise<string> {
    if (configPath) {
      return configPath;
    }

    const defaultConfigPath = path.resolve(process.cwd(), 'tressi.config.json');
    try {
      await fs.access(defaultConfigPath);
      return defaultConfigPath;
    } catch {
      throw new Error(
        'No config file provided and tressi.config.json not found in the current directory.',
      );
    }
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Run a load test using the specified configuration file. This is the default action when no specific command is provided.';
  }
}

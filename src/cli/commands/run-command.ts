import chalk from 'chalk';
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
   */
  async execute(configPath?: string): Promise<void> {
    const resolvedConfigPath = await this.resolveConfigPath(configPath);

    try {
      const config = await loadConfig(resolvedConfigPath);
      await runLoadTest(config);
    } catch {
      process.exit(1);
    }
  }

  /**
   * Resolves the configuration file path.
   * @param configPath Optional configuration path provided by user
   * @returns Resolved configuration path
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
      // eslint-disable-next-line no-console
      console.error(
        chalk.red(
          'Error: No config file provided and tressi.config.json not found in the current directory.',
        ),
      );
      // eslint-disable-next-line no-console
      console.log(
        chalk.yellow(
          'Please specify a config file using --config or run `tressi init` to create one.',
        ),
      );
      process.exit(1);
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

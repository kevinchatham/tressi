import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

import { loadConfig } from '../../config';
import type { DisplayOptions } from '../../types';
import { displayConfig } from '../display/config-display';

/**
 * Handles the 'config' command for displaying Tressi configuration.
 */
export class ConfigCommand {
  /**
   * Executes the config command.
   * @param options Command options
   * @param options.json Output configuration as JSON
   * @param options.raw Show raw configuration without defaults
   * @param configPath Path to configuration file
   * @returns Promise that resolves when the command completes
   */
  async execute(
    options: { json?: boolean; raw?: boolean },
    configPath?: string,
  ): Promise<void> {
    const resolvedConfigPath = await this.resolveConfigPath(configPath);

    try {
      const config = await loadConfig(resolvedConfigPath);
      const displayOptions: DisplayOptions = {
        json: options.json,
        raw: options.raw,
        source: resolvedConfigPath,
      };
      displayConfig(config, displayOptions);
    } catch (error) {
      this.handleConfigError(error, resolvedConfigPath);
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
   * Handles configuration loading errors.
   * @param error The error that occurred
   * @param configPath The path that was being loaded
   */
  private handleConfigError(error: unknown, configPath: string): void {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        // eslint-disable-next-line no-console
        console.error(chalk.red(`Configuration file not found: ${configPath}`));
      } else if (error.message.includes('JSON')) {
        // eslint-disable-next-line no-console
        console.error(chalk.red('Invalid JSON in configuration file'));
      } else {
        // eslint-disable-next-line no-console
        console.error(chalk.red(`Configuration error: ${error.message}`));
      }
    }
    process.exit(1);
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Display the current configuration including all resolved values, defaults, and request definitions. Shows configuration source and schema version being used.';
  }
}

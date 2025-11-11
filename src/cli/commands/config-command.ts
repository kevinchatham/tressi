import { promises as fs } from 'fs';
import path from 'path';

import { loadConfig } from '../../config';
import type { DisplayOptions, TressiConfig } from '../../types';
import { displayConfig } from '../display/config-display';

export interface ConfigCommandDependencies {
  loadConfig: (configPath: string) => Promise<TressiConfig>;
  displayConfig: (config: TressiConfig, options: DisplayOptions) => void;
  fs: {
    access: (path: string) => Promise<void>;
  };
  path: {
    resolve: (...paths: string[]) => string;
  };
  cwd: () => string;
}

/**
 * Handles the 'config' command for displaying Tressi configuration.
 */
export class ConfigCommand {
  private readonly deps: ConfigCommandDependencies;

  constructor(deps: Partial<ConfigCommandDependencies> = {}) {
    this.deps = {
      loadConfig: deps.loadConfig || loadConfig,
      displayConfig: deps.displayConfig || displayConfig,
      fs: deps.fs || { access: fs.access.bind(fs) },
      path: deps.path || { resolve: path.resolve.bind(path) },
      cwd: deps.cwd || ((): string => process.cwd()),
    };
  }

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
      const config = await this.deps.loadConfig(resolvedConfigPath);
      const displayOptions: DisplayOptions = {
        json: options.json,
        raw: options.raw,
        source: resolvedConfigPath,
      };
      this.deps.displayConfig(config, displayOptions);
    } catch (error) {
      this.handleConfigError(error, resolvedConfigPath);
    }
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

    const defaultConfigPath = this.deps.path.resolve(
      this.deps.cwd(),
      'tressi.config.json',
    );
    try {
      await this.deps.fs.access(defaultConfigPath);
      return defaultConfigPath;
    } catch {
      const error = new Error(
        'No config file provided and tressi.config.json not found in the current directory.',
      );
      (error as { code?: string }).code = 'ENOENT';
      throw error;
    }
  }

  /**
   * Handles configuration loading errors.
   * @param error The error that occurred
   * @param configPath The path that was being loaded
   * @throws Error with appropriate message for the error type
   */
  private handleConfigError(error: unknown, configPath: string): never {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        throw new Error(`Configuration file not found: ${configPath}`);
      } else if (error.message.includes('JSON')) {
        throw new Error('Invalid JSON in configuration file');
      } else {
        throw new Error(`Configuration error: ${error.message}`);
      }
    }
    throw new Error('Unknown configuration error');
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Display the current configuration including all resolved values, defaults, and request definitions. Shows configuration source and schema version being used.';
  }
}

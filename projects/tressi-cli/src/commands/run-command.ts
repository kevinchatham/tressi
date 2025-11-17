import { promises as fs } from 'fs';
import path from 'path';
import type { TressiConfig } from 'tressi-common';

import { runLoadTest } from '..';
import { ConfigValidator } from '../validation/config-validator';

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
    const config = await this.loadAndValidateConfig(resolvedConfigPath);
    await runLoadTest(config);
  }

  /**
   * Loads and validates configuration from file or URL
   * @param configPath Path to configuration file
   * @returns Validated configuration
   */
  private async loadAndValidateConfig(
    configPath: string,
  ): Promise<TressiConfig> {
    let rawContent: unknown;

    if (configPath.startsWith('http://') || configPath.startsWith('https://')) {
      const { request } = await import('undici');
      const { statusCode, body } = await request(configPath);
      if (statusCode >= 400) {
        throw new Error(`Remote config fetch failed: ${statusCode}`);
      }
      rawContent = await body.json();
    } else {
      const absolutePath = path.resolve(configPath);
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      rawContent = JSON.parse(fileContent);
    }

    return ConfigValidator.validateForCLI(rawContent);
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

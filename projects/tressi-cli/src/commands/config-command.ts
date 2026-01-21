import chalk from 'chalk';

import { defaultTressiConfig } from '../common/config/defaults';
import {
  TressiConfig,
  TressiOptionsConfig,
  TressiRequestConfig,
} from '../common/config/types';
import { loadConfig } from '../core/config';
import { DisplayOptions } from '../reporting/types';
import { terminal } from '../tui/terminal';

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
    try {
      const { config, path } = await loadConfig(configPath);
      const displayOptions: DisplayOptions = {
        json: options.json,
        raw: options.raw,
        source: path,
      };
      this.displayConfig(config, displayOptions);
    } catch (error) {
      throw error;
    }
  }

  private displayConfig(config: TressiConfig, options: DisplayOptions): void {
    if (options.json) {
      terminal.print(
        JSON.stringify(this.formatConfigAsJson(config, options), null, 2),
      );
      return;
    }

    if (options.raw) {
      terminal.print(JSON.stringify(config, null, 2));
      return;
    }

    this.displayHumanReadable(config, options);
  }

  private displayHumanReadable(
    config: TressiConfig,
    options: DisplayOptions,
  ): void {
    terminal.print(chalk.bold('\n📋 Current Tressi Configuration'));
    terminal.print(
      chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'),
    );

    terminal.print(
      `${chalk.blue('🔧 Configuration Source:')} ${options.source || 'defaults'}`,
    );
    terminal.print(`${chalk.blue('📄 Schema:')} ${config.$schema}\n`);

    terminal.print(chalk.bold('🎯 Options:'));
    this.displayOptionsWithDefaults(config.options);

    terminal.print(
      chalk.bold(`\n🌐 Requests (${config.requests.length} total):`),
    );

    config.requests.forEach((request, index) => {
      this.displayRequest(index + 1, request);
    });
  }

  private displayOptionsWithDefaults(options: TressiOptionsConfig): void {
    const entries = [
      {
        key: 'concurrency',
        value: 'Adaptive (based on system metrics)',
        default: 'Adaptive',
      },
      {
        key: 'durationSec',
        value: options.durationSec,
        default: defaultTressiConfig.options.durationSec,
      },
      {
        key: 'silent',
        value: options.silent,
        default: defaultTressiConfig.options.silent,
      },
      { key: 'exportPath', value: options.exportPath, default: undefined },
      {
        key: 'headers',
        value: options.headers,
        default: defaultTressiConfig.options.headers,
      },
    ];

    entries.forEach(({ key, value, default: defaultValue }) => {
      const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue);
      const marker = isDefault
        ? chalk.gray('(default)')
        : chalk.green('(explicit)');
      const displayValue =
        value === undefined
          ? 'null'
          : typeof value === 'object'
            ? JSON.stringify(value)
            : value;
      terminal.print(`  • ${key}: ${displayValue} ${marker}`);
    });
  }

  private displayRequest(index: number, request: TressiRequestConfig): void {
    terminal.print(`  ${index}. ${request.method || 'GET'} ${request.url}`);
    terminal.print(`     RPS: ${request.rps || 1}`);
    if (request.headers && Object.keys(request.headers).length > 0) {
      terminal.print(
        `     Headers: ${JSON.stringify(request.headers, null, 2).replace(/\n/g, '\n            ')}`,
      );
    }
    if (request.payload) {
      terminal.print(
        `     Payload: ${JSON.stringify(request.payload, null, 2).replace(/\n/g, '\n            ')}`,
      );
    }
  }

  private formatConfigAsJson(
    config: TressiConfig,
    options: DisplayOptions,
  ): Record<string, unknown> {
    return {
      source: options.source || 'defaults',
      config: {
        $schema: config.$schema,
        options: config.options,
        requests: config.requests,
      },
      defaults: defaultTressiConfig.options,
    };
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Display the current configuration including all resolved values, defaults, and request definitions. Shows configuration source and schema version being used.';
  }
}

import chalk from 'chalk';
import { Command } from 'commander';

import pkg from '../../../package.json';
import { ConfigCommand } from './commands/config-command';
import { InitCommand } from './commands/init-command';
import { RunCommand } from './commands/run-command';
import { clearTerminal } from './utils/cli-utils';

/**
 * The main CLI application for Tressi.
 */
export class TressiCLI {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupProgram();
    this.setupCommands();
    this.setupHelp();
  }

  /**
   * Sets up the base program configuration.
   */
  private setupProgram(): void {
    this.program
      .name('tressi')
      .description('A modern, simple load testing tool for APIs.')
      .version(pkg.version);

    this.program.option(
      '-c, --config [path]',
      'Path or URL to JSON configuration file (local file path or remote URL). Defaults to ./tressi.config.json',
    );
  }

  /**
   * Sets up all CLI commands.
   */
  private setupCommands(): void {
    // Init command
    this.program
      .command('init')
      .summary('Create a tressi.config.json file')
      .description(InitCommand.getDescription())
      .option(
        '--full',
        'Generate a full configuration with all available options and advanced features',
      )
      .action(async (options) => {
        const command = new InitCommand();
        await command.execute(options);
      });

    // Config command
    this.program
      .command('config')
      .summary('Display current configuration')
      .description(ConfigCommand.getDescription())
      .option('--json', 'Output configuration as JSON')
      .option('--raw', 'Show raw configuration without defaults filled in')
      .action(async (options) => {
        const command = new ConfigCommand();
        const configPath = this.program.opts().config;
        await command.execute(options, configPath);
      });

    // Default run command (when no specific command is provided)
    this.program.action(async (opts) => {
      const command = new RunCommand();
      await command.execute(opts.config);
    });
  }

  /**
   * Sets up help text and examples.
   */
  private setupHelp(): void {
    this.program.addHelpText(
      'after',
      `
Commands:
  init    Create a tressi.config.json file
  config  Display current configuration

Options:
  -c, --config <path>  Path or URL to JSON configuration file (local file path or remote URL)
                       Defaults to ./tressi.config.json if not specified

Examples:
  # Create a minimal tressi.config.json file in current directory
  $ tressi init

  # Create a comprehensive configuration with all available options
  $ tressi init --full

  # View current configuration with resolved values and defaults
  $ tressi config

  # View configuration as JSON for programmatic use
  $ tressi config --json

  # View raw configuration without defaults filled in
  $ tressi config --raw

  # Run a load test using default tressi.config.json in current directory
  $ tressi

  # Run a load test with a specific local configuration file
  $ tressi --config ./path/to/your/tressi.config.json

  # Run a load test with a remote configuration file
  $ tressi --config https://example.com/tressi.config.json

  # View configuration from a specific file
  $ tressi --config ./my-config.json config
`,
    );
  }

  /**
   * Runs the CLI application.
   */
  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(chalk.red(`CLI Error: ${(error as Error).message}`));
      process.exit(1);
    }
  }
}

async function runCLI(): Promise<void> {
  clearTerminal();
  const cli = new TressiCLI();
  await cli.run();
}

runCLI().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('CLI Error:', error);
  process.exit(1);
});

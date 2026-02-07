import chalk from 'chalk';
import { Command } from 'commander';

import pkg from '../../../package.json';
import { RunCommand } from './commands/run-command';
import { ServeCommand } from './commands/serve-command';
import { initializeDatabase } from './database/init';
import { terminal } from './tui/terminal';

/**
 * The main CLI application for Tressi.
 */
class TressiCLI {
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
    this.program.option(
      '-e, --export [path]',
      'Export test results to specified path (supports .json, .xlsx, .md formats)',
    );
    this.program.option(
      '-s, --silent',
      'Run in silent mode without TUI or progress output',
      false,
    );
  }

  /**
   * Sets up all CLI commands.
   */
  private setupCommands(): void {
    // Serve command
    this.program
      .command('serve')
      .summary('Start a Hono server with healthcheck endpoint')
      .description(ServeCommand.getDescription())
      .option('-p, --port <port>', 'Server port (default: 3108)', '3108')
      .action(async (options) => {
        const command = new ServeCommand();
        const port = parseInt(options.port, 10);
        await command.execute({ port });
      });

    // Default run command (when no specific command is provided)
    this.program.action(async (opts) => {
      const command = new RunCommand();
      await command.execute(opts.config, opts.export, opts.silent);
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
  serve   Start a Hono server with healthcheck endpoint

Options:
  -c, --config <path>  Path or URL to JSON configuration file (local file path or remote URL)
                        Defaults to ./tressi.config.json if not specified
  -e, --export <path>  Export test results to specified path (supports .json, .xlsx, .md formats)
  -s, --silent         Run in silent mode without TUI or progress output

Examples:
  # Run a load test using default tressi.config.json in current directory
  $ tressi

  # Run a load test with a specific local configuration file
  $ tressi --config ./path/to/your/tressi.config.json

  # Run a load test with a remote configuration file
  $ tressi --config https://example.com/tressi.config.json

  # Run a load test and export results to JSON
  $ tressi --export ./results/test-results.json

  # Run a load test silently and export to XLSX
  $ tressi --silent --export ./results/test-results.xlsx

  # Run a load test with custom config, silent mode, and export
  $ tressi --config ./my-config.json --silent --export ./results/report.xlsx

  # Start the Tressi server on default port (3108 - the speed of light in m/s)
  $ tressi serve

  # Start the Tressi server on a custom port
  $ tressi serve --port 8080
`,
    );
  }

  /**
   * Runs the CLI application.
   */
  async run(): Promise<void> {
    terminal.clear();

    try {
      // Initialize database before any commands run
      await initializeDatabase();
      await this.program.parseAsync(process.argv);
    } catch (error) {
      terminal.print(chalk.red(`CLI Error: ${(error as Error).message}`));
      process.exit(1);
    }
  }
}

async function runCLI(): Promise<void> {
  const cli = new TressiCLI();
  await cli.run();
}

runCLI().catch((error) => {
  terminal.print('CLI Error:', error);
  process.exit(1);
});

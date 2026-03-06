import chalk from 'chalk';
import { Command } from 'commander';

import pkg from '../../../package.json';
import { ResetCommand } from './commands/reset-command';
import { RunCommand } from './commands/run-command';
import { ServeCommand } from './commands/serve-command';
import { initializeDatabase } from './database/init';
import { terminal } from './tui/terminal';

/**
 * The main CLI application for Tressi.
 */
class TressiCLI {
  private _program: Command;

  constructor() {
    this._program = new Command();
    this._setupProgram();
    this._setupCommands();
    this._setupHelp();
  }

  /**
   * Sets up the base program configuration.
   */
  private _setupProgram(): void {
    this._program
      .name('tressi')
      .description('A modern load testing tool for APIs.')
      .version(pkg.version);

    this._program.option(
      '-e, --export <path>',
      'Export test results to the specified directory',
    );
    this._program.option(
      '-s, --silent',
      'Disable TUI and progress output',
      false,
    );

    this._program.option(
      '-m, --migrate',
      'Migrate configurations without prompting',
      false,
    );

    this._program.option('-f, --force', 'Force the database reset', false);
  }

  /**
   * Sets up all CLI commands.
   */
  private _setupCommands(): void {
    // Run command
    this._program
      .command('run')
      .argument('<config>', 'Path or URL to JSON configuration file')
      .summary('Execute a load test')
      .description(RunCommand.getDescription())
      .action(async (config, _options, commandInstance) => {
        const command = new RunCommand();
        const globalOptions = commandInstance.optsWithGlobals();
        await command.execute(
          config,
          globalOptions.export,
          globalOptions.silent,
          globalOptions.migrate,
        );
      });

    // Serve command
    this._program
      .command('serve')
      .summary('Start the management server')
      .description(ServeCommand.getDescription())
      .option('-p, --port <port>', 'Server port (default: 3108)', '3108')
      .action(async (options, commandInstance) => {
        const command = new ServeCommand();
        const globalOptions = commandInstance.optsWithGlobals();
        const port = parseInt(options.port, 10);
        await command.execute({ port, migrate: globalOptions.migrate });
      });

    // Reset command
    this._program
      .command('reset')
      .summary('Reset the database')
      .description(ResetCommand.getDescription())
      .option('-f, --force', 'Bypass confirmation prompts.', false)
      .action(async (options) => {
        const command = new ResetCommand();
        await command.execute(options.force);
      });
  }

  /**
   * Sets up help text and examples.
   */
  private _setupHelp(): void {
    this._program.addHelpText(
      'after',
      `
Commands:
  run <config>  Execute a load test using the specified configuration file
  serve         Start the management server
  reset         Reset the database

Options:
  -e, --export <path>  Export test results to the specified directory
  -s, --silent         Disable TUI and progress output

Examples:
  # Run a load test with a specific local configuration file
  $ tressi run ./my-config.json

  # Run a load test with a remote configuration file
  $ tressi run "https://example.com/tressi.config.json"

  # Run a load test and export results to JSON
  $ tressi run ./my-config.json --export ./results/test-results.json

  # Run a load test silently and export to XLSX
  $ tressi run ./my-config.json --silent --export ./results/test-results.xlsx

  # Start the Tressi server on default port (3108 <-> c≈3x10^8 m/s)
  $ tressi serve

  # Start the Tressi server on a custom port
  $ tressi serve --port 8080

  # Reset the Tressi database
  $ tressi reset

  # Reset the Tressi database without confirmation
  $ tressi reset --force
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
      await this._program.parseAsync(process.argv);
    } catch (error) {
      terminal.error(chalk.red(`CLI Error: ${(error as Error).message}`));
      process.exit(1);
    }
  }
}

async function runCLI(): Promise<void> {
  const cli = new TressiCLI();
  await cli.run();
}

runCLI().catch((error) => {
  terminal.error('CLI Error:', error);
  process.exit(1);
});

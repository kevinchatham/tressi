import chalk from 'chalk';
import { Command } from 'commander';

import pkg from '../../../package.json';
import { MigrateCommand } from './commands/migrate-command';
import { ResetCommand } from './commands/reset-command';
import { RunCommand } from './commands/run-command';
import { ServeCommand } from './commands/serve-command';
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
      .description('Deterministic load testing for API performance validation.')
      .version(pkg.version);
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
      .option(
        '-e, --export <path>',
        'Export test results to the specified directory',
      )
      .option('-s, --silent', 'Disable TUI and progress output', false)
      .action(async (config, options) => {
        const command = new RunCommand();
        await command.execute(config, options.export, options.silent);
      });

    // Serve command
    this._program
      .command('serve')
      .summary('Start the management server')
      .description(ServeCommand.getDescription())
      .option('-p, --port <port>', 'Server port (default: 3108)', '3108')
      .action(async (options) => {
        const command = new ServeCommand();
        const port = parseInt(options.port, 10);
        await command.execute({
          port,
        });
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

    // Migrate command
    this._program
      .command('migrate')
      .argument('<config>', 'Path to JSON configuration file')
      .summary('Migrate a configuration file')
      .description(MigrateCommand.getDescription())
      .option('-f, --force', 'Bypass confirmation prompts.', false)
      .action(async (config, options) => {
        const command = new MigrateCommand();
        await command.execute(config, options.force);
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
  migrate <config> Migrate a configuration file to the current version

Examples:
  # Run a load test with a specific local configuration file
  $ tressi run ./my-config.json

  # Run a load test with a remote configuration file
  $ tressi run "https://example.com/tressi.config.json"

  # Run a load test and export results
  $ tressi run ./my-config.json --export ./results

  # Start the Tressi server on default port (3108 <-> c≈3x10^8 m/s)
  $ tressi serve

  # Start the Tressi server on a custom port
  $ tressi serve --port 8080

  # Reset the Tressi database
  $ tressi reset

  # Reset the Tressi database without confirmation
  $ tressi reset --force

  # Migrate a configuration file
  $ tressi migrate ./my-config.json

  # Migrate a configuration file without confirmation
  $ tressi migrate ./my-config.json --force
`,
    );
  }

  /**
   * Runs the CLI application.
   */
  async run(): Promise<void> {
    terminal.clear();

    try {
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

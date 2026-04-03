import chalk from 'chalk';
import { type Argument, Command, type Option } from 'commander';

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
      .version(pkg.version, '-v, --version');
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
      .option('-e, --export <path>', 'Export test results to the specified directory')
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
      .action(async (config) => {
        const command = new MigrateCommand();
        await command.execute(config);
      });
  }

  /**
   * Sets up help text and examples.
   */
  private _setupHelp(): void {
    this._program.configureHelp({
      argumentTerm: (arg: Argument) => chalk.white(`<${arg.name()}>`),
      commandDescription: () => chalk.gray(''),
      helpWidth: 80,
      optionDescription: (opt: Option) => `  ${opt.description}`,
      optionTerm: (opt: Option) => {
        const short = opt.short ? `${opt.short}, ` : '    ';
        return `${chalk.yellow(short)}${opt.long}`;
      },
      sortOptions: true,
      sortSubcommands: true,
      subcommandTerm: (cmd: Command) => {
        const args = cmd.registeredArguments.map((a) => `<${a.name()}>`).join(' ');
        const options = cmd.options.length ? ` [options]` : '';
        return `${chalk.green(cmd.name())} ${chalk.white(args)}${chalk.dim(options)}`;
      },
    });

    this._program.addHelpText(
      'beforeAll',
      `${chalk.yellow.bold('⚡')} ${chalk.bold(`Tressi v${pkg.version}`)}\n`,
    );

    this._program.addHelpText(
      'after',
      '\n' +
        chalk.cyan('Examples:') +
        `
  ${chalk.gray('# Run a load test')}
  ${chalk.white('$')} ${chalk.green('tressi run')} ./config.json

  ${chalk.gray('# Start the Tressi server (3108 <-> c≈3×10⁸ m/s)')}
  ${chalk.white('$')} ${chalk.green('tressi serve')}

  ${chalk.gray('# Reset the database')}
  ${chalk.white('$')} ${chalk.green('tressi reset')}

  ${chalk.gray('# Migrate a configuration file')}
  ${chalk.white('$')} ${chalk.green('tressi migrate')} ./config.json
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

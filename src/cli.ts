import chalk from 'chalk';
import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';

import pkg from '../package.json';
import { runLoadTest } from '.';
import {
  generateFullConfig,
  generateMinimalConfig,
  loadConfig,
} from './config';
import { displayConfig } from './config-display';

/**
 * The main commander program instance.
 */
const program = new Command();

program
  .name('tressi')
  .description('A modern, simple load testing tool for APIs.')
  .version(pkg.version);

program.option(
  '-c, --config [path]',
  'Path or URL to JSON configuration file (local file path or remote URL). Defaults to ./tressi.config.json',
);

program
  .command('init')
  .summary('Create a tressi.config.json file')
  .description(
    `Create a tressi configuration file to define your load testing scenarios.

This command generates a JSON configuration file that specifies:
- Target URLs and endpoints to test
- Request methods, headers, and payloads
- Load patterns (concurrent users, duration, ramp-up)
- Performance thresholds and success criteria
- Output formats and reporting options

By default, a minimal configuration is created with essential settings for quick start. Use --full to generate a comprehensive configuration with all available options, including advanced features like custom distributions, detailed assertions, and multiple test phases.

After creation, edit the configuration file to match your API testing requirements, then run 'tressi' to execute your load tests.`,
  )
  .option(
    '--full',
    'Generate a full configuration with all available options and advanced features',
  )
  .action(async (options) => {
    const fileName = `tressi.config.json`;
    const filePath = path.resolve(process.cwd(), fileName);

    try {
      await fs.access(filePath);
      // eslint-disable-next-line no-console
      console.log(
        chalk.yellow(
          `Configuration file ${fileName} already exists. Skipping.`,
        ),
      );
      return;
    } catch {
      try {
        const config = options.full
          ? generateFullConfig()
          : generateMinimalConfig();
        await fs.writeFile(filePath, JSON.stringify(config, null, 2));
        // eslint-disable-next-line no-console
        console.log(
          chalk.green(`Successfully created ${fileName} at ${filePath}`),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          chalk.red(`Failed to create config file: ${(err as Error).message}`),
        );
        process.exit(1);
      }
    }
  });

program
  .command('config')
  .summary('Display current configuration')
  .description(
    'Display the current configuration including all resolved values, defaults, and request definitions. Shows configuration source and schema version being used.',
  )
  .option('--json', 'Output configuration as JSON')
  .option('--raw', 'Show raw configuration without defaults filled in')
  .action(async (options) => {
    let configPath = program.opts().config;

    if (!configPath) {
      const defaultConfigPath = path.resolve(
        process.cwd(),
        'tressi.config.json',
      );
      try {
        await fs.access(defaultConfigPath);
        configPath = defaultConfigPath;
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

    try {
      const config = await loadConfig(configPath);
      displayConfig(config, {
        json: options.json,
        raw: options.raw,
        source: configPath,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          // eslint-disable-next-line no-console
          console.error(
            chalk.red(`Configuration file not found: ${configPath}`),
          );
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
  });

program.addHelpText(
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

/**
 * The main action for the program. This is executed when the user runs `tressi`
 * with options, but without a specific command like `init`.
 */
program.action(async (opts) => {
  let configPath = opts.config;

  if (!configPath) {
    const defaultConfigPath = path.resolve(process.cwd(), 'tressi.config.json');
    try {
      await fs.access(defaultConfigPath);
      configPath = defaultConfigPath;
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

  try {
    const config = await loadConfig(configPath);
    await runLoadTest(config);
  } catch {
    process.exit(1);
  }
});

program.parseAsync(process.argv);

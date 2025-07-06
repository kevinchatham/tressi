import chalk from 'chalk';
import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';

import pkg from '../package.json';
import { runLoadTest } from '.';

/**
 * Template for a JSON-based tressi configuration file.
 */
const jsonConfigTemplate = `{
  "$schema": "https://raw.githubusercontent.com/kevinchatham/tressi/main/schemas/tressi.schema.v${pkg.version}.json",
  "requests": [
    {
      "url": "https://jsonplaceholder.typicode.com/posts/1",
      "method": "GET"
    },
    {
      "url": "https://jsonplaceholder.typicode.com/posts",
      "method": "POST",
      "payload": {
        "name": "Tressi Post"
      }
    }
  ]
}
`;

/**
 * The main commander program instance.
 */
const program = new Command();

program
  .name('tressi')
  .description('A modern, simple load testing tool for APIs.')
  .version(pkg.version);

program
  .option(
    '-c, --config [path]',
    'Path or URL to JSON config file. Defaults to ./tressi.config.json',
  )
  .option(
    '--workers <n>',
    'Number of concurrent workers, or max workers if autoscale is enabled',
    '10',
  )
  .option('--duration <s>', 'Duration in seconds', '10')
  .option('--ramp-up-time <s>', 'Time in seconds to ramp up to the target RPS')
  .option('--rps <n>', 'Target requests per second')
  .option('--autoscale', 'Enable autoscaling of workers')
  .option(
    '--export [path]',
    'Export a comprehensive report (Markdown, XLSX, CSVs) to a directory.',
  )
  .option('--no-ui', 'Disable the interactive terminal UI');

program
  .command('init')
  .summary('Create a tressi.config.json file')
  .description('Create a boilerplate tressi configuration file')
  .action(async () => {
    const fileName = `tressi.config.json`;
    const filePath = path.resolve(process.cwd(), fileName);

    try {
      await fs.access(filePath);
      // If the file exists, we shouldn't overwrite it without permission,
      // but for simplicity, we'll just log a message. In a real-world
      // scenario, you'd prompt the user.
      // eslint-disable-next-line no-console
      console.log(
        chalk.yellow(
          `Configuration file ${fileName} already exists. Skipping.`,
        ),
      );
      return;
    } catch {
      // File does not exist, continue
    }

    try {
      await fs.writeFile(filePath, jsonConfigTemplate);
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
  });

program.addHelpText(
  'after',
  `
Examples:
  # Create a tressi.config.json file
  $ tressi init

  # Run a load test using the tressi.config.json in the current directory
  $ tressi

  # Run a load test with a specific config file
  $ tressi --config ./path/to/your/tressi.config.json
  
  # Run an autoscaling test up to 50 workers with a target of 1000 RPS
  $ tressi --autoscale --workers 50 --rps 1000 --duration 60

  # Export a complete report to a timestamped directory
  $ tressi --export

  # Export a report to a custom-named, timestamped directory
  $ tressi --export ./my-report
  
  # Run a load test without the interactive terminal UI
  $ tressi --no-ui
  
  # Run a load test with 20 concurrent workers
  $ tressi --workers 20
  
  # Run a load test for 30 seconds
  $ tressi --duration 30
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

  if (opts.autoscale && !opts.rps) {
    // eslint-disable-next-line no-console
    console.error('Error: --rps is required when --autoscale is enabled.');
    process.exit(1);
  }

  try {
    await runLoadTest({
      config: configPath,
      workers: opts.workers ? parseInt(opts.workers, 10) : undefined,
      durationSec: opts.duration ? parseInt(opts.duration, 10) : undefined,
      rampUpTimeSec: opts.rampUpTime
        ? parseInt(opts.rampUpTime, 10)
        : undefined,
      rps: opts.rps ? parseInt(opts.rps, 10) : undefined,
      autoscale: opts.autoscale,
      exportPath: opts.export,
      useUI: opts.ui,
    });
  } catch {
    // The runLoadTest function handles its own error logging.
    // We just need to ensure the process exits with an error code.
    process.exit(1);
  }
});

/**
 * Parses the command line arguments and runs the program.
 */
program.parseAsync(process.argv);

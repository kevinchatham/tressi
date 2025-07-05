import chalk from 'chalk';
import { Command } from 'commander';
import { promises as fs } from 'fs';
import inquirer from 'inquirer';
import path from 'path';

import pkg from '../package.json';
import { runLoadTest } from '.';

/**
 * Template for a TypeScript-based tressi configuration file.
 */
const tsConfigTemplate = `import { defineConfig } from 'tressi';

export default defineConfig({
  // Common headers for all requests can be defined here
  // headers: {
  //   'Authorization': \`Bearer \${process.env.API_TOKEN}\`,
  // },
  requests: [
    {
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
    },
    {
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      payload: {
        name: 'Tressi Post',
      },
    },
  ],
});
`;

/**
 * Template for a JSON-based tressi configuration file.
 */
const jsonConfigTemplate = `{
  "headers": {
    "Content-Type": "application/json; charset=UTF-8"
  },
  "requests": [
    {
      "url": "https://jsonplaceholder.typicode.com/posts/1",
      "method": "GET"
    },
    {
      "url": "https://jsonplaceholder.typicode.com/posts",
      "method": "POST",
      "payload": {
        "title": "foo",
        "body": "bar",
        "userId": 1
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
  .option('-c, --config <path>', 'Path or URL to config file (.ts or .json)')
  .option(
    '--workers <n>',
    'Number of concurrent workers, or max workers if autoscale is enabled',
    '10',
  )
  .option('--duration <s>', 'Duration in seconds', '10')
  .option(
    '--ramp-up-time <s>',
    'Time in seconds to ramp up to the target RPM',
  )
  .option('--rps <n>', 'Target requests per second')
  .option('--autoscale', 'Enable autoscaling of workers')
  .option('--csv <path>', 'CSV output path')
  .option('--no-ui', 'Disable live charts (enabled by default)');

program
  .command('init')
  .description('Create a boilerplate tressi configuration file')
  .action(async () => {
    const { format } = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'What format do you want your config file to be in?',
        choices: ['typescript', 'json'],
      },
    ]);

    const fileExt = format === 'typescript' ? 'ts' : 'json';
    const fileName = `tressi.config.${fileExt}`;
    const filePath = path.resolve(process.cwd(), fileName);
    const template = fileExt === 'ts' ? tsConfigTemplate : jsonConfigTemplate;

    try {
      await fs.access(filePath);
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Configuration file ${fileName} already exists. Do you want to overwrite it?`,
          default: false,
        },
      ]);

      if (!overwrite) {
        // eslint-disable-next-line no-console
        console.log(chalk.yellow('Aborted.'));
        return;
      }
    } catch {
      // File does not exist, continue
    }

    try {
      await fs.writeFile(filePath, template);
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
  # Initialize a new config file
  $ tressi init
  
  # Run a load test with a config file
  $ tressi --config ./tressi.config.ts

  # Run a load test with a config file and save results to a CSV file
  $ tressi --config ./tressi.config.ts --csv ./results.csv
  
  # Run a load test with a config file and disable the interactive terminal UI
  $ tressi --config ./tressi.config.ts --no-ui
  
  # Run a load test with a config file and set the concurrency to 20
  $ tressi --config ./tressi.config.ts --workers 20
  
  # Run a load test with a config file and set the duration to 30 seconds
  $ tressi --config ./tressi.config.ts --duration 30
  
  # Run a load test with a config file and set the requests per minute limit to 100
  $ tressi --config ./tressi.config.ts --rpm 100
`,
);

/**
 * The main action for the program. This is executed when the user runs `tressi`
 * with options, but without a specific command like `init`.
 */
program.action(async (opts) => {
  // If no config is provided, and no command was run, show help.
  // This handles the case where the user just runs `tressi`.
  if (!opts.config) {
    program.help();
    return;
  }

  if (opts.autoscale && !opts.rps) {
    // eslint-disable-next-line no-console
    console.error('Error: --rps is required when --autoscale is enabled.');
    process.exit(1);
  }

  try {
    await runLoadTest({
      config: opts.config,
      workers: opts.workers ? parseInt(opts.workers, 10) : undefined,
      durationSec: opts.duration ? parseInt(opts.duration, 10) : undefined,
      rampUpTimeSec: opts.rampUpTime
        ? parseInt(opts.rampUpTime, 10)
        : undefined,
      rps: opts.rps ? parseInt(opts.rps, 10) : undefined,
      autoscale: opts.autoscale,
      csvPath: opts.csv,
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

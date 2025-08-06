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
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer <your-token>"
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
        "name": "Tressi Post"
      },
      "headers": {
        "X-Custom-Header": "custom-value"
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
  .description(
    'A modern, simple load testing tool for APIs. Uses JSON configuration files as the primary method for test configuration.',
  )
  .version(pkg.version);

program
  .option(
    '-c, --config [path]',
    'Path or URL to JSON config file. Defaults to ./tressi.config.json',
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
  
  # Run a load test without the interactive terminal UI
  $ tressi --no-ui
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
    await runLoadTest({
      config: configPath,
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
 * Only parse if this file is the main module (not imported for testing).
 */
export async function runCli(args: string[] = process.argv): Promise<void> {
  await program.parseAsync(args);
}

if (require.main === module) {
  runCli();
}

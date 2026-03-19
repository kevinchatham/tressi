/** biome-ignore-all lint/suspicious/noConsole: default */

import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import chalk from 'chalk';
import ora from 'ora';

console.clear();

const args: string[] = process.argv.slice(2);
let command: string = args[0];

const commands: Record<string, { cmd: string[]; desc: string; spinner: string }> = {
  down: {
    cmd: ['compose', 'down'],
    desc: 'Stopping Tressi',
    spinner: 'Shutting down...',
  },
  logs: {
    cmd: ['compose', 'logs', '-f'],
    desc: 'Streaming logs',
    spinner: 'Streaming logs...',
  },
  restart: {
    cmd: ['compose', 'restart'],
    desc: 'Restarting Tressi',
    spinner: 'Restarting...',
  },
  up: {
    cmd: ['compose', 'up', '-d', '--build'],
    desc: 'Starting Tressi in Docker',
    spinner: 'Launching containers...',
  },
};

async function askCommand(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.bold('\n⚡ Tressi Docker Manager\n'));
  const options = Object.keys(commands);
  options.forEach((opt, i) => {
    console.log(`${chalk.cyan(`${i + 1}.`)} ${chalk.bold(opt.padEnd(10))} ${commands[opt].desc}`);
  });
  console.log(`${chalk.cyan('q.')} ${chalk.bold('quit'.padEnd(10))} Exit manager`);

  return new Promise((resolve) => {
    rl.question(chalk.yellow('\nWhat would you like to do? '), (answer) => {
      rl.close();
      console.clear();
      const index = parseInt(answer, 10) - 1;
      if (options[index]) {
        resolve(options[index]);
      } else if (commands[answer.toLowerCase()]) {
        resolve(answer.toLowerCase());
      } else if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'quit') {
        process.exit(0);
      } else {
        console.log(chalk.red('\nInvalid option. Please try again.'));
        resolve(askCommand());
      }
    });
  });
}

async function executeCommand(cmdKey: string): Promise<void> {
  const { cmd, desc, spinner: spinnerText } = commands[cmdKey];
  console.log(chalk.bold(`\n📦 ${desc}`));

  const spinner = ora(spinnerText).start();

  const child = spawn('docker', cmd, {
    stdio: cmdKey === 'logs' ? 'inherit' : 'pipe',
  });

  if (cmdKey !== 'logs') {
    child.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) spinner.text = chalk.dim(line);
    });

    return new Promise<void>((resolve) => {
      child.on('close', (code) => {
        if (code === 0) {
          spinner.succeed(chalk.green(`${desc} successful!`));
          if (cmdKey === 'up') {
            console.log(`\n🌍 Dashboard: ${chalk.underline.blue('http://localhost:3108')}\n`);
          }
        } else {
          spinner.fail(chalk.red(`${desc} failed with code ${code}`));
        }
        resolve();
      });
    });
  }
}

async function run(): Promise<void> {
  if (!command || !commands[command]) {
    command = await askCommand();
  }
  await executeCommand(command);
}

run().catch(console.error);

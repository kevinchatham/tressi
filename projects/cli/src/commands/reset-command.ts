import * as readline from 'node:readline/promises';

import chalk from 'chalk';

import { db } from '../data/database';
import { terminal } from '../tui/terminal';

/**
 * Handles the 'reset' command for clearing the Tressi database.
 */
export class ResetCommand {
  /**
   * Executes the reset command.
   * Asks for user confirmation before deleting all data from the database.
   * Verifies that all tables are cleared after the operation.
   */
  async execute(force?: boolean): Promise<void> {
    try {
      if (!force) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        try {
          terminal.print(
            chalk.yellow(
              '\n⚠️  WARNING: This will permanently delete all configurations, tests, and metrics.',
            ),
          );
          const answer = await rl.question(
            chalk.white('Are you sure you want to reset Tressi? (y/N): '),
          );

          if (answer.toLowerCase() !== 'y') {
            terminal.print(
              chalk.blue('\nReset cancelled. No data was deleted.'),
            );
            return;
          }
        } finally {
          rl.close();
        }
      }

      terminal.print(chalk.cyan('\nResetting Tressi database...'));

      // 1. Perform Deletion (Cascades from configs to tests and metrics)
      await db.deleteFrom('configs').execute();

      // 2. Verification Step
      const tables = ['configs', 'tests', 'metrics'] as const;
      const verificationResults = await Promise.all(
        tables.map(async (table) => {
          const result = await db
            .selectFrom(table)
            .select(db.fn.countAll().as('count'))
            .executeTakeFirst();
          return { table, count: Number(result?.count ?? 0) };
        }),
      );

      const unclearedTables = verificationResults.filter((r) => r.count > 0);

      if (unclearedTables.length === 0) {
        terminal.print(
          chalk.green(
            '✅ Tressi has been successfully reset. All tables are empty.',
          ),
        );
      } else {
        const tableList = unclearedTables
          .map((t) => `${t.table} (${t.count} rows)`)
          .join(', ');
        terminal.print(
          chalk.red(
            `\n⚠️  Partial reset: Some tables still contain data: ${tableList}`,
          ),
        );
      }
    } catch (error) {
      terminal.print(
        chalk.red(`\n❌ Error during reset: ${(error as Error).message}`),
      );
      throw error;
    }
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Reset the database, removing all configurations and test data.';
  }
}

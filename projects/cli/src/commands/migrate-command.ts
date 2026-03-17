import chalk from 'chalk';

import { JsonMigrationManager } from '../data/json-migration-manager';
import { terminal } from '../tui/terminal';

/**
 * Handles the 'migrate' command for updating configuration files to the latest schema version.
 */
export class MigrateCommand {
  /**
   * Executes the migrate command.
   * @param configPath Path to the configuration file to migrate.
   * @param force If true, bypass confirmation prompts.
   */
  async execute(configPath: string, force = false): Promise<void> {
    try {
      const migrationManager = new JsonMigrationManager();
      await migrationManager.migrateFile(configPath, force);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      terminal.error(
        chalk.red(`\nFailed to execute migrate command: ${message}`),
      );

      if (message.includes('ENOENT')) {
        terminal.print(
          chalk.yellow(
            `Hint: Ensure the file path "${configPath}" is correct.`,
          ),
        );
      } else if (error instanceof SyntaxError) {
        terminal.print(
          chalk.yellow(
            'Hint: The file appears to contain invalid JSON. Please check for syntax errors.',
          ),
        );
      } else if (message.includes('EACCES') || message.includes('EPERM')) {
        terminal.print(
          chalk.yellow(
            'Hint: Permission denied. Check if you have read/write access to the file.',
          ),
        );
      }

      process.exit(1);
    }
  }

  /**
   * Gets the command description for help text.
   * @returns Command description
   */
  static getDescription(): string {
    return 'Migrate a configuration file to the current version.';
  }
}

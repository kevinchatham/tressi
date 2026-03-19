import { copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as readline from 'node:readline/promises';

import type { Database } from '@tressi/shared/cli';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Kysely } from 'kysely';
import ora from 'ora';
import semver from 'semver';

import pkg from '../../../../package.json';
import { terminal } from '../tui/terminal';
import { DATABASE_MIGRATIONS } from './migrations';

/**
 * Manages the detection and execution of database schema migrations.
 */
export class DatabaseMigrationManager {
  constructor(private _db: Kysely<Database>) {}

  /**
   * Runs all pending database migrations.
   */
  async run(): Promise<void> {
    // Ensure the migrations table exists before checking version
    await this._db.schema
      .createTable('migrations')
      .ifNotExists()
      .addColumn('version', 'text', (col) => col.primaryKey())
      .addColumn('applied_at', 'integer', (col) => col.notNull())
      .execute();

    const currentVersion = await this._getCurrentVersion();
    const targetVersion = pkg.version;

    // If this is a fresh install, stamp the current version and exit
    if (currentVersion === '0.0.0') {
      await this._updateVersion(targetVersion, this._db);
      return;
    }

    // Find all migrations between current and target version
    const pendingVersions = Object.keys(DATABASE_MIGRATIONS)
      .filter((v) => semver.gt(v, currentVersion) && semver.lte(v, targetVersion))
      .sort(semver.compare);

    if (pendingVersions.length === 0) {
      return;
    }

    terminal.print(`\n${chalk.bold.blue('📦 Tressi Database Migration Required')}`);
    terminal.print(`${chalk.dim('Current Version:')} ${chalk.yellow(currentVersion)}`);
    terminal.print(`${chalk.dim('Target Version: ')} ${chalk.green(targetVersion)}\n`);

    const table = new Table({
      colWidths: [15, 60],
      head: [chalk.cyan('Version'), chalk.cyan('Summary')],
      wordWrap: true,
    });

    for (const v of pendingVersions) {
      const migration = DATABASE_MIGRATIONS[v];
      table.push([v, migration.summary]);
    }

    terminal.print(chalk.bold('Pending database migrations:'));
    terminal.print(table.toString());

    const confirmed = await this._promptUser(
      `\nWould you like to apply these ${pendingVersions.length} database migration(s)? (y/N): `,
    );

    if (!confirmed) {
      terminal.print(
        chalk.red(
          '\nDatabase migration declined. The application cannot continue with an outdated schema.',
        ),
      );
      process.exit(1);
    }

    // Create a backup before applying migrations
    await this._backupDatabase(currentVersion);

    const spinner = ora().start();

    for (const v of pendingVersions) {
      const migration = DATABASE_MIGRATIONS[v];
      spinner.text = `Applying database migration ${chalk.cyan(v)}: ${migration.summary}`;

      try {
        // Run migration in a transaction for safety
        await this._db.transaction().execute(async (trx) => {
          await migration.up(trx);
          await this._updateVersion(v, trx);
        });
        spinner.succeed(`Applied database migration ${chalk.cyan(v)}`);
        spinner.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        spinner.fail(chalk.red(`Failed to apply database migration ${v}: ${message}`));
        throw error; // Halt if a migration fails to prevent data corruption
      }
    }

    spinner.stop();
    terminal.print(chalk.green('Database migrations complete.'));
  }

  /**
   * Creates a backup of the database file.
   * @param version The current version of the database.
   */
  private async _backupDatabase(version: string): Promise<void> {
    const rootDir = join(homedir(), '.tressi');
    const dbPath = process.env['TRESSI_DB_PATH'] || join(rootDir, 'tressi.db');
    const timestamp = Date.now();
    const backupPath = join(dirname(dbPath), `tressi-${version}-${timestamp}.db.bak`);

    try {
      await copyFile(dbPath, backupPath);
      terminal.print(chalk.dim(`Database backup created: ${backupPath}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      terminal.error(chalk.red(`Failed to create database backup: ${message}`));
      throw new Error(`Database migration halted: Could not create backup. ${message}`);
    }
  }

  /**
   * Gets the current database version from the migrations table.
   */
  private async _getCurrentVersion(): Promise<string> {
    const result = await this._db
      .selectFrom('migrations')
      .select('version')
      .orderBy('version', 'desc')
      .limit(1)
      .executeTakeFirst();

    return result?.version || '0.0.0';
  }

  /**
   * Updates the database version in the migrations table.
   */
  private async _updateVersion(version: string, trx: Kysely<Database>): Promise<void> {
    await trx
      .insertInto('migrations')
      .values({
        applied_at: Date.now(),
        version,
      })
      .execute();
  }

  /**
   * Prompts the user to confirm the migration.
   * @param message The prompt message.
   * @returns A promise that resolves to true if confirmed, false otherwise.
   */
  private async _promptUser(message: string): Promise<boolean> {
    if (!process.stdin.isTTY) {
      terminal.error(
        'Non-interactive environment detected. Skipping database migration. The application may not function correctly.',
      );
      return false;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await rl.question(message);
      return answer.toLowerCase() === 'y';
    } finally {
      rl.close();
    }
  }
}

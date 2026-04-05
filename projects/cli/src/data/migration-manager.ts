import * as fs from 'node:fs/promises';
import { copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { dirname, join } from 'node:path';
import * as readlineSync from 'node:readline/promises';

import type { Database as DatabaseSchema, VersionedTressiConfig } from '@tressi/shared/cli';
import { type ConfigDocument, type TressiConfig, TressiConfigSchema } from '@tressi/shared/common';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Kysely } from 'kysely';
import ora, { type Ora } from 'ora';
import semver from 'semver';

import pkg from '../../../../package.json';
import { configStorage } from '../collections/config-collection';
import { terminal } from '../tui/terminal';
import { MIGRATIONS } from './migrations';

/**
 * Manages database and configuration migrations for the Tressi application.
 * Handles version tracking, migration execution, and config file updates.
 */
export class MigrationManager {
  private readonly _db: Kysely<DatabaseSchema>;

  constructor(db: Kysely<DatabaseSchema>) {
    this._db = db;
  }

  /**
   * Extracts the version number from a Tressi schema URL.
   * @param schemaUrl - The schema URL to parse (e.g., "https://...tressi.schema.v1.2.3.json")
   * @returns The extracted version string (e.g., "1.2.3")
   * @throws Error if the schema URL is missing or malformed
   */
  static getVersion(schemaUrl: string | undefined | null): string {
    if (!schemaUrl) {
      throw new Error('Missing required property: "$schema"');
    }
    const regex = /v?(\d+\.\d+\.\d+)(?:\.json)?$/;
    const match = regex.exec(schemaUrl);
    if (!match) {
      throw new Error(
        'Invalid "$schema" format. Expected a Tressi schema URL containing a version (e.g., "...v0.0.13.json")',
      );
    }
    return match[1];
  }

  /**
   * Runs all pending database and configuration migrations in a single coordinated operation.
   * Creates the migrations table if it doesn't exist, displays pending migrations,
   * prompts for confirmation, and executes all migrations with fail-fast behavior.
   * @returns Promise that resolves when all migrations are complete, or rejects on failure
   * @throws Process exit with code 1 if user declines migration or backup creation fails
   */
  async migrate(): Promise<void> {
    await this._db.schema
      .createTable('migrations')
      .ifNotExists()
      .addColumn('version', 'text', (col) => col.primaryKey())
      .addColumn('type', 'text', (col) => col.notNull().defaultTo('db'))
      .addColumn('applied_at', 'integer', (col) => col.notNull())
      .execute();

    const pending = await this._getPendingMigrations();
    if (pending.db.length === 0 && pending.config.length === 0) {
      return;
    }

    terminal.print(`\n${chalk.bold.blue('📦 Tressi Migration Required')}`);
    terminal.print(`${chalk.dim('Current Version:')} ${chalk.yellow(pending.currentVersion)}`);
    terminal.print(`${chalk.dim('Target Version: ')} ${chalk.green(pkg.version)}\n`);

    const table = new Table({
      colWidths: [15, 15, 60],
      head: [chalk.cyan('Version'), chalk.cyan('Type'), chalk.cyan('Summary')],
      wordWrap: true,
    });

    for (const v of pending.db) {
      table.push([v, 'db', MIGRATIONS[v].db.summary]);
    }
    for (const v of pending.config) {
      table.push([v, 'config', MIGRATIONS[v].config.summary]);
    }

    terminal.print(chalk.bold('Pending migrations:'));
    terminal.print(table.toString());

    const confirmed = await this._promptUser(
      `\nWould you like to apply these ${pending.db.length + pending.config.length} migration(s)? (y/N): `,
    );

    if (!confirmed) {
      terminal.print(chalk.red('\nMigration declined. The application cannot continue.'));
      process.exit(1);
    }

    await this._backupDatabase(pending.currentVersion);

    const spinner = ora().start();

    await this._applyDatabaseMigrations(pending.db, spinner);

    const configFailures: string[] = [];
    for (const v of pending.config) {
      spinner.text = `Checking config migrations ${chalk.cyan(v)}...`;
      spinner.start();
    }

    const configs = await configStorage.getAll();
    const outdated = this._findOutdatedConfigs(configs, configFailures);

    this._applyConfigMigrations(outdated, spinner, configFailures);

    spinner.stop();

    this._reportMigrationResults(configFailures);
  }

  /**
   * Validates that a configuration file matches the current Tressi version.
   * @param filePath - Absolute path to the configuration file to validate
   * @returns Promise that resolves if version matches, exits with error otherwise
   */
  async validateVersion(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const currentVersion = pkg.version;

    try {
      await fs.access(absolutePath, fs.constants.R_OK);
    } catch {
      return;
    }

    let config: VersionedTressiConfig;
    try {
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      config = JSON.parse(fileContent);
    } catch {
      return;
    }

    let configVersion: string;
    try {
      configVersion = MigrationManager.getVersion(config.$schema);
    } catch (error) {
      terminal.error(
        `Configuration file "${filePath}" is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      process.exit(1);
    }

    if (configVersion !== currentVersion) {
      const configVersionText = `v${configVersion}`;
      const currentVersionText = `v${currentVersion}`;
      terminal.print(`\n${chalk.bold.red('❌ Configuration Version Mismatch')}`);
      terminal.print(`${chalk.dim('File:           ')} ${chalk.white(filePath)}`);
      terminal.print(`${chalk.dim('Config Version: ')} ${chalk.yellow(configVersionText)}`);
      terminal.print(`${chalk.dim('Tressi Version: ')} ${chalk.green(currentVersionText)}`);
      terminal.print(
        `\nTo run this configuration, please use Tressi ${chalk.cyan(configVersionText)} or update the configuration to ${chalk.cyan(currentVersionText)}.`,
      );
      process.exit(1);
    }
  }

  /**
   * Migrates a single configuration file to the current Tressi version.
   * Creates a backup of the original file before migration.
   * @param filePath - Absolute path to the configuration file to migrate
   * @returns Promise that resolves when migration is complete
   */
  async migrateFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const currentVersion = pkg.version;

    try {
      await fs.access(absolutePath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      return;
    }

    let fileContent: string;
    let config: VersionedTressiConfig;
    try {
      fileContent = await fs.readFile(absolutePath, 'utf-8');
      config = JSON.parse(fileContent);
    } catch {
      return;
    }

    let configVersion: string;
    try {
      configVersion = MigrationManager.getVersion(config.$schema);
    } catch (error) {
      terminal.error(
        `Configuration file "${filePath}" is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return;
    }

    if (!semver.lt(configVersion, currentVersion)) {
      return;
    }

    terminal.print(
      `Configuration file "${filePath}" is using an outdated schema (v${configVersion}).`,
    );

    const { summaries, migratedData } = this._migrateConfig(config);

    terminal.print(`\n${chalk.bold.blue('📄 File Migration Required')}`);
    terminal.print(`${chalk.dim('File:           ')} ${chalk.white(filePath)}`);
    terminal.print(`${chalk.dim('Current Version:')} ${chalk.yellow(configVersion)}`);
    terminal.print(`${chalk.dim('Target Version: ')} ${chalk.green(currentVersion)}\n`);

    const table = new Table({
      colWidths: [15, 60],
      head: [chalk.cyan('Version'), chalk.cyan('Summary')],
      wordWrap: true,
    });

    for (const { version, summary } of summaries) {
      table.push([version, summary]);
    }
    terminal.print(chalk.bold('Pending configuration migrations:'));
    terminal.print(table.toString());

    this._displayDiff(config, migratedData);

    const confirmed = await this._promptUser(
      `\nWould you like to migrate "${filePath}" to version ${currentVersion}? (y/N): `,
    );
    if (!confirmed) {
      terminal.print(
        chalk.red(
          '\nFile migration declined. The application cannot continue with an outdated configuration file.',
        ),
      );
      process.exit(1);
    }

    const spinner = ora(`Migrating "${filePath}"...`).start();

    try {
      const backupPath = `${absolutePath}.bak`;
      const backupPathDisplay = `${filePath}.bak`;
      await fs.copyFile(absolutePath, backupPath);
      spinner.text = `Created backup at "${chalk.dim(backupPathDisplay)}"`;

      await fs.writeFile(absolutePath, JSON.stringify(migratedData, null, 2), 'utf-8');
      spinner.succeed(`Successfully migrated "${chalk.cyan(filePath)}".`);
    } catch (error) {
      spinner.fail(
        chalk.red(
          `Failed to migrate file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  }

  /**
   * Creates a timestamped backup of the database file.
   * @param version - The version string to include in the backup filename
   * @throws Error if backup creation fails
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
   * Determines which migrations need to be applied based on current vs target version.
   * @returns Object containing current version and arrays of pending db and config migrations
   */
  private async _getPendingMigrations(): Promise<{
    currentVersion: string;
    db: string[];
    config: string[];
  }> {
    const result = await this._db
      .selectFrom('migrations')
      .select('version')
      .orderBy('version', 'desc')
      .limit(1)
      .executeTakeFirst();

    const currentVersion = result?.version || '0.0.0';
    const targetVersion = pkg.version;

    if (currentVersion === targetVersion) {
      return { config: [], currentVersion, db: [] };
    }

    const pendingVersions = Object.keys(MIGRATIONS)
      .filter((v) => semver.gt(v, currentVersion) && semver.lte(v, targetVersion))
      .sort(semver.compare);

    return { config: pendingVersions, currentVersion, db: pendingVersions };
  }

  /**
   * Records a migration as having been applied in the database.
   * @param version - The version string of the applied migration
   * @param type - The type of migration ('db' or 'config')
   * @param trx - The transaction to execute within
   */
  private async _updateVersion(version: string, trx: Kysely<DatabaseSchema>): Promise<void> {
    await trx
      .insertInto('migrations')
      .values({
        applied_at: Date.now(),
        version,
      })
      .execute();
  }

  /**
   * Applies all necessary configuration migrations to bring a config to current version.
   * @param config - The configuration object to migrate
   * @returns The migrated configuration data and list of migration summaries applied
   */
  private _migrateConfig(config: VersionedTressiConfig): {
    migratedData: TressiConfig;
    summaries: { version: string; summary: string }[];
  } {
    const currentVersion = pkg.version;
    let data: VersionedTressiConfig = { ...config };
    let v = MigrationManager.getVersion(data.$schema);
    const summaries: { version: string; summary: string }[] = [];

    const availableVersions = Object.keys(MIGRATIONS).sort(semver.compare);

    for (const targetV of availableVersions) {
      if (semver.gt(targetV, v) && semver.lte(targetV, currentVersion)) {
        const migration = MIGRATIONS[targetV];

        summaries.push({ summary: migration.config.summary, version: targetV });

        const nextData = migration.config.up(data);
        const migratedV = MigrationManager.getVersion(nextData.$schema);

        if (migratedV !== targetV) {
          throw new Error(
            `Migration for version ${targetV} did not update the schema version correctly. Expected ${targetV}, got ${migratedV}`,
          );
        }

        data = nextData;
        v = migratedV;
      }
    }

    const migratedData = TressiConfigSchema.parse(data);

    const zodAddedFields = Object.keys(migratedData).filter((key) => !(key in data));
    if (zodAddedFields.length > 0) {
      summaries.push({
        summary: `Injected default values for new fields: ${zodAddedFields.join(', ')}`,
        version: currentVersion,
      });
    }

    return { migratedData, summaries };
  }

  /**
   * Computes semantic differences between two objects, grouping changes by parent path.
   * @param oldObj - The original object
   * @param newObj - The modified object
   * @returns Changes grouped by parent path with old and new values
   */
  private _computeSemanticDiff(oldObj: unknown, newObj: unknown): ChangesByParent {
    const changes: ChangeRecord[] = [];

    const traverse = (oldVal: unknown, newVal: unknown, currentPath: string): void => {
      if (oldVal === newVal) return;

      if (oldVal === null || oldVal === undefined || newVal === null || newVal === undefined) {
        if (oldVal !== newVal) {
          changes.push({ newValue: newVal, oldValue: oldVal, path: currentPath });
        }
        return;
      }

      const oldType = typeof oldVal;
      const newType = typeof newVal;
      if (oldType !== 'object' || newType !== 'object') {
        changes.push({ newValue: newVal, oldValue: oldVal, path: currentPath });
        return;
      }

      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        const maxLen = Math.max(oldVal.length, newVal.length);
        for (let i = 0; i < maxLen; i++) {
          const elementPath = currentPath ? `${currentPath}[${i}]` : `[${i}]`;
          traverse(oldVal[i], newVal[i], elementPath);
        }
        return;
      }

      const oldObj = oldVal as Record<string, unknown>;
      const newObjVal = newVal as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObjVal)]);

      for (const key of allKeys) {
        const propPath = currentPath ? `${currentPath}.${key}` : key;
        traverse(oldObj[key], newObjVal[key], propPath);
      }
    };

    traverse(oldObj, newObj, '');

    const grouped: ChangesByParent = {};
    for (const change of changes) {
      const path = change.path;

      let lastDotOutsideBracket = -1;
      let bracketDepth = 0;
      for (let i = 0; i < path.length; i++) {
        if (path[i] === '[') bracketDepth++;
        else if (path[i] === ']') bracketDepth--;
        else if (path[i] === '.' && bracketDepth === 0) {
          lastDotOutsideBracket = i;
        }
      }

      let parentPath: string;
      let leafKey: string;

      if (lastDotOutsideBracket === -1) {
        parentPath = '';
        leafKey = path;
      } else {
        parentPath = path.substring(0, lastDotOutsideBracket);
        leafKey = path.substring(lastDotOutsideBracket + 1);
      }

      if (!grouped[parentPath]) {
        grouped[parentPath] = { newValues: {}, oldValues: {} };
      }

      grouped[parentPath].oldValues[leafKey] = change.oldValue;
      grouped[parentPath].newValues[leafKey] = change.newValue;
    }

    return grouped;
  }

  /**
   * Formats a value for display in diff output.
   * @param val - The value to format
   * @returns Formatted string representation
   */
  private _formatValue(val: unknown): string {
    if (val === null || val === undefined) {
      return '';
    }
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return '';
    }
  }

  /**
   * Displays a semantic diff between two configuration objects in a human-readable format.
   * @param oldObj - The original configuration object
   * @param newObj - The migrated configuration object
   */
  private _displayDiff(oldObj: unknown, newObj: unknown): void {
    const grouped = this._computeSemanticDiff(oldObj, newObj);
    const paths = Object.keys(grouped).filter((p) => p !== '');

    if (paths.length === 0) {
      terminal.print(chalk.dim('  No changes detected.'));
      return;
    }

    paths.sort((a, b) => a.localeCompare(b));

    for (const parentPath of paths) {
      const { oldValues, newValues } = grouped[parentPath];
      const header = parentPath.startsWith('[') ? parentPath : chalk.bold.cyan(parentPath);
      terminal.print(`  ${header}:`);
      this._printDiffLines(oldValues, newValues);
    }

    if (grouped['']) {
      terminal.print(`  ${chalk.bold.cyan('root:')}`);
      const rootChanges = grouped[''];
      this._printDiffLines(rootChanges.oldValues, rootChanges.newValues);
    }
  }

  private _printDiffLines(
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
  ): void {
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
    for (const key of allKeys) {
      const oldVal = oldValues[key];
      const newVal = newValues[key];

      if (oldVal != null && newVal != null) {
        terminal.print(
          `    ${chalk.red('-')} ${key}: ${chalk.red(this._formatValue(oldVal))} → ${chalk.green(this._formatValue(newVal))}`,
        );
      } else if (newVal != null) {
        terminal.print(`    ${chalk.green('+')} ${key}: ${chalk.green(this._formatValue(newVal))}`);
      } else if (oldVal != null) {
        terminal.print(`    ${chalk.red('-')} ${key}: ${chalk.red(this._formatValue(oldVal))}`);
      }
    }
  }

  /**
   * Prompts the user for confirmation in interactive mode.
   * In non-interactive environments, returns false unless TRESSI_AUTO_MIGRATE is set.
   * @param message - The prompt message to display
   * @returns True if user confirmed with 'y', or if auto-migrate is enabled in non-interactive mode
   */
  private async _promptUser(message: string): Promise<boolean> {
    if (!process.stdin.isTTY) {
      if (process.env['TRESSI_AUTO_MIGRATE'] === 'true') {
        return true;
      }
      terminal.error(
        chalk.yellow('\nNon-interactive environment detected. Declining migration and exiting.'),
      );
      return false;
    }

    const rl = readlineSync.createInterface({
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

  private async _applyDatabaseMigrations(pendingDb: string[], spinner: Ora): Promise<void> {
    for (const v of pendingDb) {
      const migration = MIGRATIONS[v];
      spinner.text = `Applying database migration ${chalk.cyan(v)}: ${migration.db.summary}`;

      try {
        await this._db.transaction().execute(async (trx) => {
          await migration.db.up(trx);
          await this._updateVersion(v, trx);
        });
        spinner.succeed(`Applied database migration ${chalk.cyan(v)}`);
        spinner.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        spinner.fail(chalk.red(`Failed to apply database migration ${v}: ${message}`));
        throw error;
      }
    }
  }

  private _findOutdatedConfigs(
    configs: ConfigDocument[],
    failures: string[],
  ): { doc: ConfigDocument; version: string }[] {
    const outdated: { doc: ConfigDocument; version: string }[] = [];

    for (const doc of configs) {
      try {
        const configVersion = MigrationManager.getVersion(doc.config.$schema);
        if (semver.lt(configVersion, pkg.version)) {
          outdated.push({ doc, version: configVersion });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        terminal.error(`Configuration "${doc.name}" in database is invalid: ${message}`);
        failures.push(`${doc.name}: ${message}`);
      }
    }

    return outdated;
  }

  private _applyConfigMigrations(
    outdated: { doc: ConfigDocument; version: string }[],
    spinner: Ora,
    failures: string[],
  ): void {
    for (const { doc } of outdated) {
      spinner.text = `Migrating configuration "${chalk.cyan(doc.name)}"...`;
      try {
        const { migratedData } = this._migrateConfig(doc.config);
        configStorage.edit({
          config: migratedData,
          id: doc.id,
          name: doc.name,
        });
        spinner.succeed(`Migrated: ${chalk.cyan(doc.name)}`);
        spinner.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        spinner.fail(chalk.red(`Failed to migrate "${doc.name}": ${message}`));
        failures.push(`${doc.name}: ${message}`);
        spinner.start();
      }
    }
  }

  private _reportMigrationResults(failures: string[]): void {
    if (failures.length > 0) {
      const failureList = failures.map((f) => `- ${f}`).join('\n');
      terminal.error(
        chalk.red(
          `Configuration migration completed with ${failures.length} failure(s):\n${failureList}`,
        ),
      );
    } else {
      terminal.print(chalk.green('Migration complete.'));
    }
  }
}

interface ChangeRecord {
  newValue: unknown;
  oldValue: unknown;
  path: string;
}

interface ChangesByParent {
  [parentPath: string]: {
    oldValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
  };
}

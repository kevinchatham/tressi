import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';

import {
  ConfigDocument,
  TressiConfig,
  TressiConfigSchema,
} from '@tressi/shared/common';
import chalk from 'chalk';
import semver from 'semver';

import pkg from '../../../../package.json';
import { configStorage } from '../collections/config-collection';
import { terminal } from '../tui/terminal';
import { MIGRATIONS, VersionedConfig } from './registry';

/**
 * Manages the detection and execution of schema migrations for stored configurations and files.
 */
export class MigrationManager {
  /**
   * Extracts the version string from a schema URL.
   * @param schemaUrl The URL to extract the version from.
   * @returns The version string (e.g., '0.0.13') or '0.0.0' if not found.
   */
  static getVersion(schemaUrl: string | undefined | null): string {
    if (!schemaUrl) {
      throw new Error('Missing required property: "$schema"');
    }
    const match = schemaUrl.match(/v(\d+\.\d+\.\d+)\.json$/);
    if (!match) {
      throw new Error(
        'Invalid "$schema" format. Expected a Tressi schema URL containing a version (e.g., "...v0.0.13.json")',
      );
    }
    return match[1];
  }

  /**
   * Checks for outdated configurations in the database and prompts the user to migrate them.
   * @param force If true, skip the confirmation prompt and migrate automatically.
   */
  async run(force = false): Promise<void> {
    const configs = await configStorage.getAll();
    const currentVersion = pkg.version;
    const failures: string[] = [];

    const outdated: ConfigDocument[] = [];

    for (const doc of configs) {
      try {
        const configVersion = MigrationManager.getVersion(doc.config.$schema);
        if (semver.lt(configVersion, currentVersion)) {
          outdated.push(doc);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        terminal.error(
          `Configuration "${doc.name}" in database is invalid: ${message}`,
        );
        failures.push(`${doc.name}: ${message}`);
      }
    }

    if (outdated.length === 0) {
      if (failures.length > 0) {
        terminal.error(
          `Found ${failures.length} invalid configuration(s) in database.`,
        );
      }
      return;
    }

    terminal.print(
      `Found ${outdated.length} configuration(s) in database using an outdated schema.`,
    );

    if (!force) {
      // Show summaries for all outdated configs
      for (const doc of outdated) {
        try {
          const { summaries, migratedData } = await this._migrateConfig(
            doc.config,
          );
          terminal.print(`\n${chalk.bold(`Changes for "${doc.name}":`)}`);
          summaries.forEach((s) => terminal.print(`- ${s}`));
          this._displayDiff(doc.config, migratedData);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          terminal.error(
            `Could not calculate migration changes for "${doc.name}": ${message}`,
          );
        }
      }

      const confirmed = await this._promptUser(
        `\nWould you like to migrate ${outdated.length} database configuration(s) to version ${currentVersion}? (y/N): `,
      );
      if (!confirmed) {
        terminal.print(
          'Database migration skipped. Outdated configurations may not function correctly.',
        );
        return;
      }
    }

    terminal.print('Starting database migration...');

    for (const doc of outdated) {
      try {
        const { migratedData } = await this._migrateConfig(doc.config);

        await configStorage.edit({
          id: doc.id,
          name: doc.name,
          config: migratedData,
        });

        terminal.print(`Successfully migrated: ${doc.name}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        terminal.error(
          `Failed to migrate configuration "${doc.name}": ${message}`,
        );
        failures.push(`${doc.name}: ${message}`);
      }
    }

    if (failures.length > 0) {
      terminal.error(
        `Database migration complete with ${failures.length} failure(s):\n${failures.map((f) => `- ${f}`).join('\n')}`,
      );
    } else {
      terminal.print('Database migration complete.');
    }
  }

  /**
   * Checks if a configuration file is outdated and prompts the user to migrate it.
   * @param filePath Path to the configuration file.
   * @param force If true, skip the confirmation prompt and migrate automatically.
   */
  async migrateFile(filePath: string, force = false): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const currentVersion = pkg.version;

    try {
      await fs.access(absolutePath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      // If file doesn't exist or isn't accessible, skip migration check
      return;
    }

    let fileContent: string;
    let config: VersionedConfig;
    try {
      fileContent = await fs.readFile(absolutePath, 'utf-8');
      config = JSON.parse(fileContent);
    } catch {
      // If file is not valid JSON, skip migration
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

    const { summaries, migratedData } = await this._migrateConfig(config);

    if (!force) {
      terminal.print(`\n${chalk.bold(`Proposed changes for "${filePath}":`)}`);
      summaries.forEach((s) => terminal.print(`- ${s}`));
      this._displayDiff(config, migratedData);

      const confirmed = await this._promptUser(
        `\nWould you like to migrate "${filePath}" to version ${currentVersion}? (y/N): `,
      );
      if (!confirmed) {
        terminal.print(
          'File migration skipped. The configuration may not function correctly.',
        );
        return;
      }
    }

    try {
      terminal.print(`Migrating "${filePath}"...`);

      // Create backup before overwriting
      const backupPath = `${absolutePath}.bak`;
      await fs.copyFile(absolutePath, backupPath);
      terminal.print(`Created backup at "${filePath}.bak"`);

      await fs.writeFile(
        absolutePath,
        JSON.stringify(migratedData, null, 2),
        'utf-8',
      );
      terminal.print(`Successfully migrated "${filePath}".`);
    } catch (error) {
      terminal.error(
        `Failed to migrate file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Core migration logic that applies sequential transformations and Zod validation.
   * @param config The configuration object to migrate.
   * @returns The migrated configuration object and a list of summaries.
   */
  private async _migrateConfig(
    config: VersionedConfig,
  ): Promise<{ migratedData: TressiConfig; summaries: string[] }> {
    const currentVersion = pkg.version;
    let data: VersionedConfig = { ...config };
    let v = MigrationManager.getVersion(data.$schema);
    const summaries: string[] = [];

    // 1. Sequential Manual Migrations
    while (semver.lt(v, currentVersion) && MIGRATIONS[v]) {
      const migration = MIGRATIONS[v];
      summaries.push(migration.summary);

      const nextData = migration.transform(data);
      const nextV = MigrationManager.getVersion(nextData.$schema);

      if (nextV === v) {
        throw new Error(
          `Migration for version ${v} did not update the schema version.`,
        );
      }

      data = nextData;
      v = nextV;
    }

    // 2. Final Zod "Default Strategy"
    // This automatically injects any new fields with .default()
    // and updates the $schema URL to the latest.
    const migratedData = TressiConfigSchema.parse(data);

    // Check if Zod added any defaults that weren't in the manual migrations
    const zodAddedFields = Object.keys(migratedData).filter(
      (key) => !(key in data),
    );
    if (zodAddedFields.length > 0) {
      summaries.push(
        `Injected default values for new fields: ${zodAddedFields.join(', ')}`,
      );
    }

    return { migratedData, summaries };
  }

  /**
   * Displays a simple line-by-line diff between two objects.
   */
  private _displayDiff(oldObj: unknown, newObj: unknown): void {
    const oldLines = JSON.stringify(oldObj, null, 2).split('\n');
    const newLines = JSON.stringify(newObj, null, 2).split('\n');

    terminal.print(`\n${chalk.cyan('--- Original')}`);
    terminal.print(`${chalk.yellow('+++ Migrated')}`);

    // Simple diffing logic (line by line)
    // Note: This is a basic implementation for visualization purposes.
    let i = 0;
    let j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length) {
        if (oldLines[i] === newLines[j]) {
          // Lines are the same, skip or show context if needed
          // For brevity, we only show changes
        } else {
          // Lines are different
          terminal.print(chalk.red(`- ${oldLines[i]}`));
          terminal.print(chalk.green(`+ ${newLines[j]}`));
        }
        i++;
        j++;
      } else if (i < oldLines.length) {
        terminal.print(chalk.red(`- ${oldLines[i]}`));
        i++;
      } else if (j < newLines.length) {
        terminal.print(chalk.green(`+ ${newLines[j]}`));
        j++;
      }
    }
  }

  /**
   * Prompts the user to confirm the migration.
   * @param message The prompt message.
   * @returns A promise that resolves to true if confirmed, false otherwise.
   */
  private async _promptUser(message: string): Promise<boolean> {
    if (!process.stdin.isTTY) {
      terminal.error(
        'Non-interactive environment detected. Skipping migration. Outdated configurations may not function correctly.',
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

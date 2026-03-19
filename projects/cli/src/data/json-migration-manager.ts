import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';

import type { VersionedTressiConfig } from '@tressi/shared/cli';
import { type ConfigDocument, type TressiConfig, TressiConfigSchema } from '@tressi/shared/common';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import semver from 'semver';

import pkg from '../../../../package.json';
import { configStorage } from '../collections/config-collection';
import { terminal } from '../tui/terminal';
import { JSON_MIGRATIONS } from './migrations';

/**
 * Manages the detection and execution of schema migrations for stored configurations and files.
 */
export class JsonMigrationManager {
  /**
   * Extracts the version string from a schema URL.
   * @param schemaUrl The URL to extract the version from.
   * @returns The version string (e.g., '0.0.13') or '0.0.0' if not found.
   */
  static getVersion(schemaUrl: string | undefined | null): string {
    if (!schemaUrl) {
      throw new Error('Missing required property: "$schema"');
    }
    // https://raw.githubusercontent.com/kevinchatham/tressi/refs/heads/main/schemas/tressi.schema.v0.0.10.json
    const match = schemaUrl.match(/v?(\d+\.\d+\.\d+)(?:\.json)?$/);
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
  async run(force: boolean = false): Promise<void> {
    const configs = await configStorage.getAll();
    const currentVersion = pkg.version;
    const failures: string[] = [];

    const outdated: ConfigDocument[] = [];

    for (const doc of configs) {
      try {
        const configVersion = JsonMigrationManager.getVersion(doc.config.$schema);
        if (semver.lt(configVersion, currentVersion)) {
          outdated.push(doc);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        terminal.error(`Configuration "${doc.name}" in database is invalid: ${message}`);
        failures.push(`${doc.name}: ${message}`);
      }
    }

    if (outdated.length === 0) {
      if (failures.length > 0) {
        terminal.error(`Found ${failures.length} invalid configuration(s) in database.`);
      }
      return;
    }

    if (!force) {
      terminal.print(`\n${chalk.bold.blue('📄 Tressi Configuration Migration Required')}`);
      terminal.print(`${chalk.dim('Target Version: ')} ${chalk.green(currentVersion)}\n`);

      // Show summaries for all outdated configs
      for (const doc of outdated) {
        try {
          const configVersion = JsonMigrationManager.getVersion(doc.config.$schema);
          const { summaries, migratedData } = await this._migrateConfig(doc.config);
          terminal.print(
            `${chalk.bold(`Changes for "${doc.name}"`)} ${chalk.dim(`(v${configVersion} → v${currentVersion})`)}:`,
          );

          const table = new Table({
            colWidths: [75],
            head: [chalk.cyan('Migration Summary')],
            wordWrap: true,
          });

          summaries.forEach((s) => void table.push([s]));
          terminal.print(table.toString());

          this._displayDiff(doc.config, migratedData);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          terminal.error(`Could not calculate migration changes for "${doc.name}": ${message}`);
        }
      }

      const confirmed = await this._promptUser(
        `\nWould you like to migrate ${outdated.length} database configuration(s) to version ${currentVersion}? (y/N): `,
      );
      if (!confirmed) {
        terminal.print(
          chalk.red(
            '\nConfiguration migration declined. The application cannot continue with outdated configurations.',
          ),
        );
        process.exit(1);
      }
    }

    const spinner = ora('Starting Configuration migration...').start();

    for (const doc of outdated) {
      spinner.text = `Migrating configuration "${chalk.cyan(doc.name)}"...`;
      try {
        const { migratedData } = await this._migrateConfig(doc.config);

        await configStorage.edit({
          config: migratedData,
          id: doc.id,
          name: doc.name,
        });

        spinner.succeed(`Successfully migrated: ${chalk.cyan(doc.name)}`);
        spinner.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        spinner.fail(chalk.red(`Failed to migrate configuration "${doc.name}": ${message}`));
        failures.push(`${doc.name}: ${message}`);
        spinner.start();
      }
    }

    spinner.stop();

    if (failures.length > 0) {
      terminal.error(
        chalk.red(
          `Configuration migration complete with ${failures.length} failure(s):\n${failures.map((f) => `- ${f}`).join('\n')}`,
        ),
      );
    } else {
      terminal.print(chalk.green('Configuration migration complete.'));
    }
  }

  /**
   * Validates that the configuration file version matches the current Tressi version.
   * If the version does not match, it exits early with a clear message.
   * @param filePath Path to the configuration file.
   */
  async validateVersion(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const currentVersion = pkg.version;

    try {
      await fs.access(absolutePath, fs.constants.R_OK);
    } catch {
      // If file doesn't exist or isn't accessible, skip validation
      // The config loader will handle the missing file error
      return;
    }

    let config: VersionedTressiConfig;
    try {
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      config = JSON.parse(fileContent);
    } catch {
      // If file is not valid JSON, skip validation
      // The config loader will handle the invalid JSON error
      return;
    }

    let configVersion: string;
    try {
      configVersion = JsonMigrationManager.getVersion(config.$schema);
    } catch (error) {
      terminal.error(
        `Configuration file "${filePath}" is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      process.exit(1);
    }

    if (configVersion !== currentVersion) {
      terminal.print(`\n${chalk.bold.red('❌ Configuration Version Mismatch')}`);
      terminal.print(`${chalk.dim('File:           ')} ${chalk.white(filePath)}`);
      terminal.print(`${chalk.dim('Config Version: ')} ${chalk.yellow(`v${configVersion}`)}`);
      terminal.print(`${chalk.dim('Tressi Version: ')} ${chalk.green(`v${currentVersion}`)}`);
      terminal.print(
        `\nTo run this configuration, please use Tressi ${chalk.cyan(`v${configVersion}`)} or update the configuration to ${chalk.cyan(`v${currentVersion}`)}.`,
      );
      process.exit(1);
    }
  }

  /**
   * Checks if a configuration file is outdated and prompts the user to migrate it.
   * @param filePath Path to the configuration file.
   * @param force If true, skip the confirmation prompt and migrate automatically.
   */
  async migrateFile(filePath: string, force: boolean = false): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const currentVersion = pkg.version;

    try {
      await fs.access(absolutePath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      // If file doesn't exist or isn't accessible, skip migration check
      return;
    }

    let fileContent: string;
    let config: VersionedTressiConfig;
    try {
      fileContent = await fs.readFile(absolutePath, 'utf-8');
      config = JSON.parse(fileContent);
    } catch {
      // If file is not valid JSON, skip migration
      return;
    }

    let configVersion: string;
    try {
      configVersion = JsonMigrationManager.getVersion(config.$schema);
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
      terminal.print(`\n${chalk.bold.blue('📄 File Migration Required')}`);
      terminal.print(`${chalk.dim('File:           ')} ${chalk.white(filePath)}`);
      terminal.print(`${chalk.dim('Current Version:')} ${chalk.yellow(configVersion)}`);
      terminal.print(`${chalk.dim('Target Version: ')} ${chalk.green(currentVersion)}\n`);

      const table = new Table({
        colWidths: [75],
        head: [chalk.cyan('Migration Summary')],
        wordWrap: true,
      });

      summaries.forEach((s) => void table.push([s]));
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
    }

    const spinner = ora(`Migrating "${filePath}"...`).start();

    try {
      // Create backup before overwriting
      const backupPath = `${absolutePath}.bak`;
      await fs.copyFile(absolutePath, backupPath);
      spinner.text = `Created backup at "${chalk.dim(`${filePath}.bak`)}"`;

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
   * Core migration logic that applies sequential transformations and Zod validation.
   * @param config The configuration object to migrate.
   * @returns The migrated configuration object and a list of summaries.
   */
  private async _migrateConfig(
    config: VersionedTressiConfig,
  ): Promise<{ migratedData: TressiConfig; summaries: string[] }> {
    const currentVersion = pkg.version;
    let data: VersionedTressiConfig = { ...config };
    let v = JsonMigrationManager.getVersion(data.$schema);
    const summaries: string[] = [];

    // 1. Sequential Manual Migrations
    // The key in JSON_MIGRATIONS is the TARGET version.
    // We sort all available migration versions and apply those that are greater than the current config version.
    const availableVersions = Object.keys(JSON_MIGRATIONS).sort(semver.compare);

    for (const targetV of availableVersions) {
      if (semver.gt(targetV, v) && semver.lte(targetV, currentVersion)) {
        const migration = JSON_MIGRATIONS[targetV];

        summaries.push(migration.summary);

        const nextData = migration.up(data);
        const migratedV = JsonMigrationManager.getVersion(nextData.$schema);

        if (migratedV !== targetV) {
          throw new Error(
            `Migration for version ${targetV} did not update the schema version correctly. Expected ${targetV}, got ${migratedV}`,
          );
        }

        data = nextData;
        v = migratedV;
      }
    }

    // 2. Final Zod "Default Strategy"
    // This automatically injects any new fields with .default()
    // and updates the $schema URL to the latest.
    const migratedData = TressiConfigSchema.parse(data);

    // Check if Zod added any defaults that weren't in the manual migrations
    const zodAddedFields = Object.keys(migratedData).filter((key) => !(key in data));
    if (zodAddedFields.length > 0) {
      summaries.push(`Injected default values for new fields: ${zodAddedFields.join(', ')}`);
    }

    return { migratedData, summaries };
  }

  /**
   * Displays a simple line-by-line diff between two objects.
   */
  private _displayDiff(oldObj: unknown, newObj: unknown): void {
    const oldLines = JSON.stringify(oldObj, null, 2).split('\n');
    const newLines = JSON.stringify(newObj, null, 2).split('\n');

    terminal.print(`\n${chalk.bgRed.white(' OLD ')} ${chalk.bgGreen.white(' NEW ')}`);

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

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
 * Represents a single change at a specific JSON path.
 */
interface ChangeRecord {
  newValue: unknown;
  oldValue: unknown;
  path: string;
}

/**
 * Groups changes by their parent path for Before/After display.
 */
interface ChangesByParent {
  [parentPath: string]: {
    oldValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
  };
}

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
   */
  async run(): Promise<void> {
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

    const previews: {
      doc: ConfigDocument;
      configVersion: string;
      migratedData: TressiConfig;
      summaries: { version: string; summary: string }[];
    }[] = [];

    for (const doc of outdated) {
      try {
        const configVersion = JsonMigrationManager.getVersion(doc.config.$schema);
        const { migratedData, summaries } = await this._migrateConfig(doc.config);
        previews.push({ configVersion, doc, migratedData, summaries });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        terminal.error(`Could not calculate migration changes for "${doc.name}": ${message}`);
        failures.push(`${doc.name}: ${message}`);
      }
    }

    if (previews.length === 0) {
      if (failures.length > 0) {
        terminal.error(
          `Configuration migration complete with ${failures.length} failure(s):\n${failures.map((f) => `- ${f}`).join('\n')}`,
        );
      } else {
        terminal.error(`No configurations could be migrated.`);
      }
      return;
    }

    terminal.print(`\n${chalk.bold.blue('📄 Tressi Configuration Migration Required')}`);
    terminal.print(`${chalk.dim('\nCurrent Version:')} ${chalk.yellow(previews[0].configVersion)}`);
    terminal.print(`${chalk.dim('Target Version: ')} ${chalk.green(currentVersion)}\n`);

    const table = new Table({
      colWidths: [15, 60],
      head: [chalk.cyan('Version'), chalk.cyan('Summary')],
      wordWrap: true,
    });

    for (const { version, summary } of previews[0].summaries) {
      table.push([version, summary]);
    }
    terminal.print(chalk.bold('Pending configuration migrations:'));
    terminal.print(table.toString());

    for (const preview of previews) {
      terminal.print('');
      terminal.print(
        `${chalk.bold.yellow(`Changes for "${preview.doc.name}"`)} ${chalk.dim(`(v${preview.configVersion} → v${currentVersion})`)}:`,
      );

      this._displayDiff(preview.doc.config, preview.migratedData);
    }

    const confirmed = await this._promptUser(
      `\nWould you like to migrate ${previews.length} database configuration(s) to version ${currentVersion}? (y/N): `,
    );
    if (!confirmed) {
      terminal.print(
        chalk.red(
          '\nConfiguration migration declined. The application cannot continue with outdated configurations.',
        ),
      );
      process.exit(1);
    }

    const spinner = ora('Starting Configuration migration...').start();

    for (const preview of previews) {
      spinner.text = `Migrating configuration "${chalk.cyan(preview.doc.name)}"...`;
      try {
        await configStorage.edit({
          config: preview.migratedData,
          id: preview.doc.id,
          name: preview.doc.name,
        });

        spinner.succeed(`Successfully migrated: ${chalk.cyan(preview.doc.name)}`);
        spinner.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        spinner.fail(
          chalk.red(`Failed to migrate configuration "${preview.doc.name}": ${message}`),
        );
        failures.push(`${preview.doc.name}: ${message}`);
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
   */
  async migrateFile(filePath: string): Promise<void> {
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
  ): Promise<{ migratedData: TressiConfig; summaries: { version: string; summary: string }[] }> {
    const currentVersion = pkg.version;
    let data: VersionedTressiConfig = { ...config };
    let v = JsonMigrationManager.getVersion(data.$schema);
    const summaries: { version: string; summary: string }[] = [];

    // 1. Sequential Manual Migrations
    // The key in JSON_MIGRATIONS is the TARGET version.
    // We sort all available migration versions and apply those that are greater than the current config version.
    const availableVersions = Object.keys(JSON_MIGRATIONS).sort(semver.compare);

    for (const targetV of availableVersions) {
      if (semver.gt(targetV, v) && semver.lte(targetV, currentVersion)) {
        const migration = JSON_MIGRATIONS[targetV];

        summaries.push({ summary: migration.summary, version: targetV });

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
      summaries.push({
        summary: `Injected default values for new fields: ${zodAddedFields.join(', ')}`,
        version: currentVersion,
      });
    }

    return { migratedData, summaries };
  }

  /**
   * Computes the semantic diff between two objects, returning changes grouped by parent path.
   */
  private _computeSemanticDiff(oldObj: unknown, newObj: unknown): ChangesByParent {
    const changes: ChangeRecord[] = [];

    const traverse = (oldVal: unknown, newVal: unknown, currentPath: string): void => {
      // Both are null/undefined or same primitive
      if (oldVal === newVal) return;

      // One is null/undefined or one is primitive
      if (oldVal === null || oldVal === undefined || newVal === null || newVal === undefined) {
        if (oldVal !== newVal) {
          changes.push({ newValue: newVal, oldValue: oldVal, path: currentPath });
        }
        return;
      }

      // Both are objects but different types
      const oldType = typeof oldVal;
      const newType = typeof newVal;
      if (oldType !== 'object' || newType !== 'object') {
        changes.push({ newValue: newVal, oldValue: oldVal, path: currentPath });
        return;
      }

      // Both are arrays
      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        const maxLen = Math.max(oldVal.length, newVal.length);
        for (let i = 0; i < maxLen; i++) {
          const elementPath = currentPath ? `${currentPath}[${i}]` : `[${i}]`;
          traverse(oldVal[i], newVal[i], elementPath);
        }
        return;
      }

      // Both are objects
      const oldObj = oldVal as Record<string, unknown>;
      const newObjVal = newVal as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObjVal)]);

      for (const key of allKeys) {
        const propPath = currentPath ? `${currentPath}.${key}` : key;
        traverse(oldObj[key], newObjVal[key], propPath);
      }
    };

    traverse(oldObj, newObj, '');

    // Group changes by parent path
    const grouped: ChangesByParent = {};
    for (const change of changes) {
      // Parse path to get parent path and leaf key
      // Path can be: $schema, options.foo, requests[0].bar, requests[0].earlyExit.enabled
      const path = change.path;

      // Find the last dot that's NOT inside brackets
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
        // No dot outside brackets - this is a root-level property
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
   * Formats a value for display, handling special types.
   */
  private _formatValue(val: unknown): string {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  /**
   * Displays a semantic diff with Before/After snippets grouped by parent object.
   */
  private _displayDiff(oldObj: unknown, newObj: unknown): void {
    const grouped = this._computeSemanticDiff(oldObj, newObj);
    const paths = Object.keys(grouped).filter((p) => p !== '');

    if (paths.length === 0) {
      terminal.print(chalk.dim('  No changes detected.'));
      return;
    }

    // Sort paths for consistent output
    paths.sort((a, b) => a.localeCompare(b));

    for (const parentPath of paths) {
      const { oldValues, newValues } = grouped[parentPath];
      const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

      const header = parentPath.startsWith('[') ? parentPath : chalk.bold.cyan(parentPath);

      terminal.print(`  ${header}:`);

      for (const key of allKeys) {
        const oldVal = oldValues[key];
        const newVal = newValues[key];

        if (oldVal !== undefined && newVal !== undefined) {
          terminal.print(
            `    ${chalk.red('-')} ${key}: ${chalk.red(this._formatValue(oldVal))} → ${chalk.green(this._formatValue(newVal))}`,
          );
        } else if (oldVal !== undefined) {
          terminal.print(`    ${chalk.red('-')} ${key}: ${chalk.red(this._formatValue(oldVal))}`);
        } else {
          terminal.print(
            `    ${chalk.green('+')} ${key}: ${chalk.green(this._formatValue(newVal))}`,
          );
        }
      }
    }

    if (grouped['']) {
      terminal.print(`  ${chalk.bold.cyan('root:')}`);

      const rootChanges = grouped[''];
      for (const key of Object.keys(rootChanges.newValues)) {
        const oldVal = rootChanges.oldValues[key];
        const newVal = rootChanges.newValues[key];

        if (oldVal !== undefined && newVal !== undefined) {
          terminal.print(
            `    ${chalk.red('-')} ${key}: ${chalk.red(this._formatValue(oldVal))} → ${chalk.green(this._formatValue(newVal))}`,
          );
        } else if (oldVal !== undefined) {
          terminal.print(`    ${chalk.red('-')} ${key}: ${chalk.red(this._formatValue(oldVal))}`);
        } else {
          terminal.print(
            `    ${chalk.green('+')} ${key}: ${chalk.green(this._formatValue(newVal))}`,
          );
        }
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
        `\n${chalk.yellow('Non-interactive environment detected. Declining migration and exiting.')}`,
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

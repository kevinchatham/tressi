import { Database } from '@tressi/shared/cli';
import { Kysely } from 'kysely';
import semver from 'semver';

import pkg from '../../../../package.json';
import { terminal } from '../tui/terminal';
import { DATABASE_MIGRATIONS } from './database-migrations';

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
      .filter(
        (v) => semver.gt(v, currentVersion) && semver.lte(v, targetVersion),
      )
      .sort(semver.compare);

    if (pendingVersions.length === 0) {
      return;
    }

    terminal.print(
      `Found ${pendingVersions.length} pending database migration(s).`,
    );

    for (const v of pendingVersions) {
      const migration = DATABASE_MIGRATIONS[v];
      terminal.print(`Applying database migration ${v}: ${migration.summary}`);

      try {
        // Run migration in a transaction for safety
        await this._db.transaction().execute(async (trx) => {
          await migration.up(trx);
          await this._updateVersion(v, trx);
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        terminal.error(`Failed to apply database migration ${v}: ${message}`);
        throw error; // Halt if a migration fails to prevent data corruption
      }
    }

    terminal.print('Database migrations complete.');
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
  private async _updateVersion(
    version: string,
    trx: Kysely<Database>,
  ): Promise<void> {
    await trx
      .insertInto('migrations')
      .values({
        version,
        applied_at: Date.now(),
      })
      .execute();
  }
}

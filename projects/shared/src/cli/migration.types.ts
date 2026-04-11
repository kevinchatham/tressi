import type { Kysely } from 'kysely';

import type { Database } from './database.types';

/**
 * Base type for versioned configurations.
 * Every configuration must have a $schema property.
 */
export type VersionedTressiConfig = {
  $schema: string;
  [key: string]: unknown;
};

/**
 * Represents a single schema migration step.
 */
export interface IJsonMigration {
  /**
   * A human-readable summary of the changes in this migration.
   */
  summary: string;
  /**
   * The transformation function to apply to the configuration.
   */
  up: (config: VersionedTressiConfig) => VersionedTressiConfig;
  version: string;
}

/**
 * Registry of manual schema migrations.
 * Key is the 'source' version.
 * Value is the Migration object containing the summary and transform function.
 */
export type JsonMigrations = Record<string, IJsonMigration>;

/**
 * Represents a single database migration step.
 */
export interface IDatabaseMigration {
  /**
   * A human-readable summary of the changes in this migration.
   */
  summary: string;
  /**
   * The transformation function to apply to the database schema.
   */
  up: (db: Kysely<Database>) => Promise<void>;
}

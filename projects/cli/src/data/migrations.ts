import { JsonMigrations } from '@tressi/shared/cli';
import { IDatabaseMigration } from '@tressi/shared/cli';

export const JSON_MIGRATIONS: JsonMigrations = {
  /**
   * Example: Renaming a field
   * '0.0.13': {
   *   summary: "Rename 'oldField' to 'newField' for better clarity.",
   *   up: (config) => {
   *     if (!('oldField' in config) || typeof config.oldField !== 'string') {
   *       throw new Error('Migration 0.0.13 failed: "oldField" is missing or not a string');
   *     }
   *     const { oldField, ...rest } = config;
   *     return {
   *       ...rest,
   *       $schema: config.$schema.replace('0.0.13', '0.0.14'),
   *       newField: oldField,
   *     };
   *   }
   * }
   */
  /**
   * Example: Moving a field into a nested object
   * '0.0.14': {
   *   summary: "Move 'timeout' into a nested 'settings' object.",
   *   up: (config) => {
   *     if (!('timeout' in config) || typeof config.timeout !== 'number') {
   *       throw new Error('Migration 0.0.14 failed: "timeout" is missing or not a number');
   *     }
   *     const { timeout, ...rest } = config;
   *     return {
   *       ...rest,
   *       $schema: config.$schema.replace('0.0.14', '0.0.15'),
   *       settings: {
   *         ...(rest.settings as Record<string, unknown> || {}),
   *         timeout,
   *       },
   *     };
   *   }
   * }
   */
  /**
   * Example: Transforming an array of items
   * '0.0.15': {
   *   summary: "Normalize endpoint methods to uppercase.",
   *   transform: (config) => {
   *     if (!('endpoints' in config) || !Array.isArray(config.endpoints)) {
   *       throw new Error('Migration 0.0.15 failed: "endpoints" is missing or not an array');
   *     }
   *     return {
   *       ...config,
   *       $schema: config.$schema.replace('0.0.15', '0.0.16'),
   *       endpoints: config.endpoints.map((endpoint: any) => ({
   *         ...endpoint,
   *         method: endpoint.method?.toUpperCase() || 'GET',
   *       })),
   *     };
   *   }
   * }
   */
};

/**
 * Registry of database migrations.
 * Key is the 'target' version.
 */
export const DATABASE_MIGRATIONS: Record<string, IDatabaseMigration> = {
  /**
   * Example:
   * '0.0.14': {
   *   summary: "Add 'description' column to 'configs' table.",
   *   up: async (db) => {
   *     await db.schema
   *       .alterTable('configs')
   *       .addColumn('description', 'text')
   *       .execute();
   *   }
   * }
   */
};

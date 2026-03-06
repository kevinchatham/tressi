/**
 * Base interface for versioned configurations.
 * Every configuration must have a $schema property.
 */
export interface VersionedConfig {
  $schema: string;
  [key: string]: unknown;
}

/**
 * Represents a single schema migration step.
 */
export interface Migration {
  /**
   * A human-readable summary of the changes in this migration.
   */
  summary: string;
  /**
   * The transformation function to apply to the configuration.
   */
  transform: (config: VersionedConfig) => VersionedConfig;
}

/**
 * Registry of manual schema migrations.
 * Key is the 'source' version.
 * Value is the Migration object containing the summary and transform function.
 */
export type MigrationRegistry = Record<string, Migration>;

export const MIGRATIONS: MigrationRegistry = {
  /**
   * Example: Renaming a field
   * '0.0.13': {
   *   summary: "Rename 'oldField' to 'newField' for better clarity.",
   *   transform: (config) => {
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
   *   transform: (config) => {
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

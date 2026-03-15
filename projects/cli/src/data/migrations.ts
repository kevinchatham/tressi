import {
  IJsonMigration,
  JsonMigrations,
  VersionedTressiConfig,
} from '@tressi/shared/cli';
import { IDatabaseMigration } from '@tressi/shared/cli';
import { TressiConfig, TressiRequestConfig } from '@tressi/shared/common';

export const noopDatabaseMigration: IDatabaseMigration = {
  summary: 'version bump',
  up: async () => {},
} as const;

export const noopJsonMigration = (targetVersion: string): IJsonMigration => ({
  summary: 'version bump',
  up: (config: VersionedTressiConfig): VersionedTressiConfig => {
    const $schema = config.$schema.replace(/\d+\.\d+\.\d+/, targetVersion);
    return {
      ...config,
      $schema,
    };
  },
});

export const JSON_MIGRATIONS: JsonMigrations = {
  // Key is the TARGET version. The up function transforms from (target - 1) to target.
  '0.0.13': noopJsonMigration('0.0.13'),
  '0.0.14': noopJsonMigration('0.0.14'),
  '0.0.15': noopJsonMigration('0.0.15'),
  '0.0.16': noopJsonMigration('0.0.16'),
  '0.0.17': {
    summary:
      'Bump early exit monitoring window configurations > 0 and < 1000 to 1000.',
    up: (config: VersionedTressiConfig): VersionedTressiConfig => {
      const data = config as TressiConfig;

      const { $schema } = noopJsonMigration('0.0.17').up(config);

      const bumpWindow = (window: number | undefined): number | undefined => {
        if (window && window > 0 && window < 1000) {
          return 1000;
        }
        return window;
      };

      const options = data.options
        ? {
            ...data.options,
            workerEarlyExit: data.options.workerEarlyExit
              ? {
                  ...data.options.workerEarlyExit,
                  monitoringWindowMs: bumpWindow(
                    data.options.workerEarlyExit.monitoringWindowMs,
                  ),
                }
              : data.options.workerEarlyExit,
          }
        : data.options;

      const requests = data.requests?.map((request: TressiRequestConfig) => ({
        ...request,
        earlyExit: request.earlyExit
          ? {
              ...request.earlyExit,
              monitoringWindowMs: bumpWindow(
                request.earlyExit.monitoringWindowMs,
              ),
            }
          : request.earlyExit,
      }));

      return {
        ...data,
        $schema,
        options,
        requests,
      } as VersionedTressiConfig;
    },
  },
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
  '0.0.14': noopDatabaseMigration,
  '0.0.15': noopDatabaseMigration,
  '0.0.16': noopDatabaseMigration,
  '0.0.17': noopDatabaseMigration,
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

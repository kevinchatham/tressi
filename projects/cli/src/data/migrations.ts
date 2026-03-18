import {
  Database,
  IJsonMigration,
  JsonMigrations,
  VersionedTressiConfig,
} from '@tressi/shared/cli';
import { IDatabaseMigration } from '@tressi/shared/cli';
import { TressiConfig, TressiRequestConfig } from '@tressi/shared/common';
import { Kysely, sql } from 'kysely';

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
};

/**
 * Registry of database migrations.
 * Key is the 'target' version.
 */
export const DATABASE_MIGRATIONS: Record<string, IDatabaseMigration> = {
  '0.0.14': noopDatabaseMigration,
  '0.0.15': noopDatabaseMigration,
  '0.0.16': noopDatabaseMigration,
  '0.0.17': {
    summary:
      'WARNING: Destructive migration. Chart data will be reset to support a more accurate summary-based storage format. Final test summaries will remain.',
    up: async (db) => {
      await dropColumnIfExists(db, 'metrics', 'url', 'idx_metrics_url');
      await db.deleteFrom('metrics').execute();
    },
  },
};

async function dropColumnIfExists(
  db: Kysely<Database>,
  table: string,
  column: string,
  index?: string,
): Promise<void> {
  const columns = await db
    .selectFrom(sql<{ name: string }>`pragma_table_info(${table})`.as('t'))
    .select('name')
    .execute();

  if (index) {
    await db.schema.dropIndex(index).ifExists().execute();
  }

  if (columns.some((c) => c.name === column)) {
    await db.schema.alterTable(table).dropColumn(column).execute();
  }
}

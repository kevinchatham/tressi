import type {
  Database,
  IDatabaseMigration,
  IJsonMigration,
  VersionedTressiConfig,
} from '@tressi/shared/cli';
import { type Kysely, sql } from 'kysely';

export type Migration = { config: IJsonMigration; db: IDatabaseMigration };

export const noopConfigMigration = (targetVersion: string): IJsonMigration => ({
  summary: 'version bump',
  up: (config: VersionedTressiConfig): VersionedTressiConfig => {
    const $schema = config.$schema.replace(/\d+\.\d+\.\d+/, targetVersion);
    return {
      ...config,
      $schema,
    };
  },
  version: targetVersion,
});

export const noopDatabaseMigration: IDatabaseMigration = {
  summary: 'version bump',
  up: async () => {},
} as const;

type ConfigUpFn = (config: VersionedTressiConfig) => VersionedTressiConfig;
type DbUpFn = (db: Kysely<Database>) => Promise<void>;

interface CreateMigrationOptions {
  configUp: ConfigUpFn | 'noop';
  dbUp: DbUpFn | 'noop';
}

export function createMigration(
  version: string,
  summary: string,
  { configUp, dbUp }: CreateMigrationOptions,
): Migration {
  return createMigrationWithSummaries(
    version,
    { configSummary: summary, dbSummary: summary },
    { configUp, dbUp },
  );
}

interface MigrationSummaries {
  configSummary: string;
  dbSummary: string;
}

export function createMigrationWithSummaries(
  version: string,
  { configSummary, dbSummary }: MigrationSummaries,
  { configUp, dbUp }: CreateMigrationOptions,
): Migration {
  if (configUp === 'noop' && dbUp === 'noop') {
    return {
      config: noopConfigMigration(version),
      db: noopDatabaseMigration,
    };
  }

  if (configUp === 'noop') {
    throw new Error(
      'configUp cannot be "noop" when dbUp is a function. Both must be atomic pairs.',
    );
  }

  if (dbUp === 'noop') {
    throw new Error(
      'dbUp cannot be "noop" when configUp is a function. Both must be atomic pairs.',
    );
  }

  return {
    config: {
      summary: configSummary,
      up: configUp,
      version,
    },
    db: {
      summary: dbSummary,
      up: dbUp,
    },
  };
}

export async function dropColumnIfExists(
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

import { migration_0_0_13 } from './migrations/migration_0_0_13';
import { migration_0_0_14 } from './migrations/migration_0_0_14';
import { migration_0_0_15 } from './migrations/migration_0_0_15';
import { migration_0_0_16 } from './migrations/migration_0_0_16';
import { migration_0_0_17 } from './migrations/migration_0_0_17';
import { migration_0_0_18 } from './migrations/migration_0_0_18';
import { migration_0_0_19 } from './migrations/migration_0_0_19';
import { migration_0_0_20 } from './migrations/migration_0_0_20';
import type { Migration } from './migrations/migration-utils';

export type { Migration };

export const MIGRATIONS: Record<string, Migration> = {
  [migration_0_0_13.config.version]: migration_0_0_13,
  [migration_0_0_14.config.version]: migration_0_0_14,
  [migration_0_0_15.config.version]: migration_0_0_15,
  [migration_0_0_16.config.version]: migration_0_0_16,
  [migration_0_0_17.config.version]: migration_0_0_17,
  [migration_0_0_18.config.version]: migration_0_0_18,
  [migration_0_0_19.config.version]: migration_0_0_19,
  [migration_0_0_20.config.version]: migration_0_0_20,
};

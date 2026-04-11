import { createMigration, type Migration } from './migration-utils';

export const migration_0_0_13: Migration = createMigration('0.0.13', 'version bump', {
  configUp: 'noop',
  dbUp: 'noop',
});

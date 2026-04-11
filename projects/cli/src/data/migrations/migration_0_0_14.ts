import { createMigration, type Migration } from './migration-utils';

export const migration_0_0_14: Migration = createMigration('0.0.14', 'version bump', {
  configUp: 'noop',
  dbUp: 'noop',
});

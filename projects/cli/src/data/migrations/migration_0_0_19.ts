import { createMigration, type Migration } from './migration-utils';

export const migration_0_0_19: Migration = createMigration('0.0.19', 'version bump', {
  configUp: 'noop',
  dbUp: 'noop',
});

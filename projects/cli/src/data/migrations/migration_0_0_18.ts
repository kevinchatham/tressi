import { createMigration, type Migration } from './migration-utils';

export const migration_0_0_18: Migration = createMigration('0.0.18', 'version bump', {
  configUp: 'noop',
  dbUp: 'noop',
});

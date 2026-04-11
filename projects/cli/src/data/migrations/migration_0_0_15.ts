import { createMigration, type Migration } from './migration-utils';

export const migration_0_0_15: Migration = createMigration('0.0.15', 'version bump', {
  configUp: 'noop',
  dbUp: 'noop',
});

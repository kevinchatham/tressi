import { createMigration, type Migration } from './migration-utils';

export const migration_0_0_16: Migration = createMigration('0.0.16', 'version bump', {
  configUp: 'noop',
  dbUp: 'noop',
});

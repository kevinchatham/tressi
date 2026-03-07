import { IDatabaseMigration } from '@tressi/shared/cli';

/**
 * Registry of database migrations.
 * Key is the 'target' version.
 */
export const DATABASE_MIGRATIONS: Record<string, IDatabaseMigration> = {
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

import type { TestRow } from '@tressi/shared/cli';
import type { TestCreate, TestDocument, TestEdit } from '@tressi/shared/common';

import { db } from '../data/database';

function mapTestFromDb(row: TestRow): TestDocument {
  return {
    configId: row.config_id,
    epochCreatedAt: row.epoch_created_at,
    error: row.error,
    id: row.id,
    status: row.status,
    summary: row.summary ? JSON.parse(row.summary) : null,
  };
}

function mapTestToDb(doc: TestDocument): TestRow {
  return {
    config_id: doc.configId,
    epoch_created_at: doc.epochCreatedAt,
    error: doc.error,
    id: doc.id,
    status: doc.status,
    summary: doc.summary ? JSON.stringify(doc.summary) : null,
  };
}

class TestCollection {
  async getAll(): Promise<TestDocument[]> {
    try {
      const rows = await db.selectFrom('tests').selectAll().execute();
      return rows.map(mapTestFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve test runs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getById(id: string): Promise<TestDocument | undefined> {
    try {
      const row = await db.selectFrom('tests').where('id', '=', id).selectAll().executeTakeFirst();
      return row ? mapTestFromDb(row) : undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve test run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async create(input: TestCreate): Promise<TestDocument> {
    try {
      const now = Date.now();
      const testDoc: TestDocument = {
        configId: input.configId,
        epochCreatedAt: now,
        error: null,
        id: crypto.randomUUID(),
        status: null,
        summary: null,
      };
      await db.insertInto('tests').values(mapTestToDb(testDoc)).execute();
      return testDoc;
    } catch (error) {
      throw new Error(
        `Failed to create test run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async edit(input: TestEdit): Promise<TestDocument> {
    try {
      const existing = await this.getById(input.id);
      if (!existing) {
        throw new Error(`Test run with ID ${input.id} not found`);
      }

      const updatedDoc: TestDocument = {
        ...existing,
        configId: input.configId ?? existing.configId,
        error: input.error ?? existing.error,
        status: input.status ?? existing.status,
        summary: input.summary ?? existing.summary,
      };

      await db
        .updateTable('tests')
        .set(mapTestToDb(updatedDoc))
        .where('id', '=', input.id)
        .execute();

      return updatedDoc;
    } catch (error) {
      throw new Error(
        `Failed to edit test run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        return false;
      }

      const result = await db.deleteFrom('tests').where('id', '=', id).executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      throw new Error(
        `Failed to delete test run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Marks all tests with 'running' status as 'stopped'.
   * This is typically called when the server starts to clean up any tests
   * that were left in a 'running' state due to an improper shutdown.
   */
  async stopAllRunningTests(): Promise<number> {
    try {
      const result = await db
        .updateTable('tests')
        .set({ error: 'Test stopped due to server restart', status: 'failed' })
        .where('status', '=', 'running')
        .executeTakeFirst();

      return Number(result.numUpdatedRows);
    } catch (error) {
      throw new Error(
        `Failed to stop running tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export const testStorage: TestCollection = new TestCollection();

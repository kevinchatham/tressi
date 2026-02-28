import { TestRow } from '@tressi/shared/cli';
import { TestCreate, TestDocument, TestEdit } from '@tressi/shared/common';

import { db } from '../database/db';

function mapTestFromDb(row: TestRow): TestDocument {
  return {
    id: row.id,
    configId: row.config_id,
    status: row.status,
    epochCreatedAt: row.epoch_created_at,
    error: row.error,
    summary: row.summary ? JSON.parse(row.summary) : null,
  };
}

function mapTestToDb(doc: TestDocument): TestRow {
  return {
    id: doc.id,
    config_id: doc.configId,
    status: doc.status,
    epoch_created_at: doc.epochCreatedAt,
    error: doc.error,
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
      const row = await db
        .selectFrom('tests')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
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
        id: crypto.randomUUID(),
        configId: input.configId,
        status: null,
        epochCreatedAt: now,
        error: null,
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
        status: input.status ?? existing.status,
        error: input.error ?? existing.error,
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

      const result = await db
        .deleteFrom('tests')
        .where('id', '=', id)
        .executeTakeFirst();
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
        .set({ status: 'failed', error: 'Test stopped due to server restart' })
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

export const testStorage = new TestCollection();

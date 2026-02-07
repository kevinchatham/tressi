import { db } from '../database/db';
import { GlobalMetricRow } from '../database/schema';
import { GlobalMetricDocument } from './types';

export type GlobalMetricCreate = Pick<
  GlobalMetricDocument,
  'testId' | 'metric' | 'epoch'
>;

function mapGlobalMetricFromDb(row: GlobalMetricRow): GlobalMetricDocument {
  return {
    id: row.id,
    testId: row.test_id,
    metric: JSON.parse(row.metric),
    epoch: row.epoch,
  };
}

function mapGlobalMetricToDb(doc: GlobalMetricDocument): GlobalMetricRow {
  return {
    id: doc.id,
    test_id: doc.testId,
    metric: JSON.stringify(doc.metric),
    epoch: doc.epoch,
  };
}

class GlobalMetricCollection {
  async getAll(): Promise<GlobalMetricDocument[]> {
    try {
      const rows = await db.selectFrom('global_metrics').selectAll().execute();
      return rows.map(mapGlobalMetricFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve global metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getById(id: string): Promise<GlobalMetricDocument | undefined> {
    try {
      const row = await db
        .selectFrom('global_metrics')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
      return row ? mapGlobalMetricFromDb(row) : undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve global metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getByTestId(testId: string): Promise<GlobalMetricDocument[]> {
    try {
      const rows = await db
        .selectFrom('global_metrics')
        .where('test_id', '=', testId)
        .selectAll()
        .execute();
      return rows.map(mapGlobalMetricFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve global metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async create(input: GlobalMetricCreate): Promise<GlobalMetricDocument> {
    try {
      const metricDoc: GlobalMetricDocument = {
        id: crypto.randomUUID(),
        testId: input.testId,
        metric: input.metric,
        epoch: input.epoch,
      };
      await db
        .insertInto('global_metrics')
        .values(mapGlobalMetricToDb(metricDoc))
        .execute();
      return metricDoc;
    } catch (error) {
      throw new Error(
        `Failed to create global metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        .deleteFrom('global_metrics')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      throw new Error(
        `Failed to delete global metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteByTestId(testId: string): Promise<number> {
    try {
      const result = await db
        .deleteFrom('global_metrics')
        .where('test_id', '=', testId)
        .executeTakeFirst();
      return Number(result.numDeletedRows || 0);
    } catch (error) {
      throw new Error(
        `Failed to delete global metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getLastByTestId(
    testId: string,
  ): Promise<GlobalMetricDocument | undefined> {
    try {
      const row = await db
        .selectFrom('global_metrics')
        .where('test_id', '=', testId)
        .orderBy('epoch', 'desc')
        .selectAll()
        .executeTakeFirst();
      return row ? mapGlobalMetricFromDb(row) : undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve last global metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // For compatibility with existing code that expects createBatch
  async createBatch(
    inputs: GlobalMetricCreate[],
  ): Promise<GlobalMetricDocument[]> {
    try {
      const metricDocs: GlobalMetricDocument[] = inputs.map((input) => ({
        id: crypto.randomUUID(),
        testId: input.testId,
        metric: input.metric,
        epoch: input.epoch,
      }));
      if (metricDocs.length === 0) {
        return [];
      }
      await db
        .insertInto('global_metrics')
        .values(metricDocs.map(mapGlobalMetricToDb))
        .execute();
      return metricDocs;
    } catch (error) {
      throw new Error(
        `Failed to create global metrics batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export const globalMetricStorage = new GlobalMetricCollection();

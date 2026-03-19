import type { MetricRow } from '@tressi/shared/cli';
import type { MetricCreate, MetricDocument } from '@tressi/shared/common';

import { db } from '../data/database';

function mapMetricFromDb(row: MetricRow): MetricDocument {
  return {
    epoch: row.epoch,
    id: row.id,
    metric: JSON.parse(row.metric),
    testId: row.test_id,
  };
}

function mapMetricToDb(doc: MetricDocument): MetricRow {
  return {
    epoch: doc.epoch,
    id: doc.id,
    metric: JSON.stringify(doc.metric),
    test_id: doc.testId,
  };
}

class MetricCollection {
  async getAll(): Promise<MetricDocument[]> {
    try {
      const rows = await db.selectFrom('metrics').selectAll().execute();
      return rows.map(mapMetricFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getById(id: string): Promise<MetricDocument | undefined> {
    try {
      const row = await db
        .selectFrom('metrics')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
      return row ? mapMetricFromDb(row) : undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getByTestId(testId: string): Promise<MetricDocument[]> {
    try {
      const rows = await db
        .selectFrom('metrics')
        .where('test_id', '=', testId)
        .selectAll()
        .execute();
      return rows.map(mapMetricFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async create(input: MetricCreate): Promise<MetricDocument> {
    try {
      const metricDoc: MetricDocument = {
        epoch: input.epoch,
        id: crypto.randomUUID(),
        metric: input.metric,
        testId: input.testId,
      };
      await db.insertInto('metrics').values(mapMetricToDb(metricDoc)).execute();
      return metricDoc;
    } catch (error) {
      throw new Error(
        `Failed to create metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async createBatch(inputs: MetricCreate[]): Promise<MetricDocument[]> {
    try {
      const metricDocs: MetricDocument[] = inputs.map((input) => ({
        epoch: input.epoch,
        id: crypto.randomUUID(),
        metric: input.metric,
        testId: input.testId,
      }));
      if (metricDocs.length === 0) {
        return [];
      }
      await db.insertInto('metrics').values(metricDocs.map(mapMetricToDb)).execute();
      return metricDocs;
    } catch (error) {
      throw new Error(
        `Failed to create metrics batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        return false;
      }

      const result = await db.deleteFrom('metrics').where('id', '=', id).executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      throw new Error(
        `Failed to delete metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteByTestId(testId: string): Promise<number> {
    try {
      const result = await db
        .deleteFrom('metrics')
        .where('test_id', '=', testId)
        .executeTakeFirst();
      return Number(result.numDeletedRows || 0);
    } catch (error) {
      throw new Error(
        `Failed to delete metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export const metricStorage: MetricCollection = new MetricCollection();

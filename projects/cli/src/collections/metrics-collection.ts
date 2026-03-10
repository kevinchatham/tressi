import { Database, MetricRow } from '@tressi/shared/cli';
import { MetricCreate, MetricDocument } from '@tressi/shared/common';
import { AliasedAggregateFunctionBuilder } from 'kysely';

import { db } from '../data/database';

function mapMetricFromDb(row: MetricRow): MetricDocument {
  return {
    id: row.id,
    testId: row.test_id,
    url: row.url,
    metric: JSON.parse(row.metric),
    epoch: row.epoch,
  };
}

function mapMetricToDb(doc: MetricDocument): MetricRow {
  return {
    id: doc.id,
    test_id: doc.testId,
    url: doc.url,
    metric: JSON.stringify(doc.metric),
    epoch: doc.epoch,
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

  async getByUrl(url: string): Promise<MetricDocument[]> {
    try {
      const rows = await db
        .selectFrom('metrics')
        .where('url', '=', url)
        .selectAll()
        .execute();
      return rows.map(mapMetricFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve metrics for URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async create(input: MetricCreate): Promise<MetricDocument> {
    try {
      const metricDoc: MetricDocument = {
        id: crypto.randomUUID(),
        testId: input.testId,
        url: input.url,
        metric: input.metric,
        epoch: input.epoch,
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
        id: crypto.randomUUID(),
        testId: input.testId,
        url: input.url,
        metric: input.metric,
        epoch: input.epoch,
      }));
      if (metricDocs.length === 0) {
        return [];
      }
      await db
        .insertInto('metrics')
        .values(metricDocs.map(mapMetricToDb))
        .execute();
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

      const result = await db
        .deleteFrom('metrics')
        .where('id', '=', id)
        .executeTakeFirst();
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

  async getLastGlobalByTestId(
    testId: string,
  ): Promise<MetricDocument | undefined> {
    try {
      const row = await db
        .selectFrom('metrics')
        .where('test_id', '=', testId)
        .where('url', '=', 'global')
        .orderBy('epoch', 'desc')
        .selectAll()
        .executeTakeFirst();
      return row ? mapMetricFromDb(row) : undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve last global metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getLastEndpointsByTestId(
    testId: string,
  ): Promise<Record<string, MetricDocument>> {
    try {
      const rows = await db
        .selectFrom('metrics')
        .where('test_id', '=', testId)
        .where('url', '!=', 'global')
        .select([
          'url',
          (
            eb,
          ): AliasedAggregateFunctionBuilder<
            Database,
            'metrics',
            number,
            'max_epoch'
          > => eb.fn.max('epoch').as('max_epoch'),
        ])
        .groupBy('url')
        .execute();

      if (rows.length === 0) {
        return {};
      }

      const result: Record<string, MetricDocument> = {};
      for (const row of rows) {
        const metricRow = await db
          .selectFrom('metrics')
          .where('test_id', '=', testId)
          .where('url', '=', row.url)
          .where('epoch', '=', row.max_epoch as number)
          .selectAll()
          .executeTakeFirst();
        if (metricRow) {
          result[row.url] = mapMetricFromDb(metricRow);
        }
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to retrieve last endpoint metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export const metricStorage = new MetricCollection();

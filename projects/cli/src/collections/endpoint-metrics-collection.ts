import { EndpointMetricRow } from '@tressi/shared/cli';
import {
  EndpointMetricCreate,
  EndpointMetricDocument,
} from '@tressi/shared/common';

import { db } from '../data/database';

function mapEndpointMetricFromDb(
  row: EndpointMetricRow,
): EndpointMetricDocument {
  return {
    id: row.id,
    testId: row.test_id,
    url: row.url,
    metric: JSON.parse(row.metric),
    epoch: row.epoch,
  };
}

function mapEndpointMetricToDb(doc: EndpointMetricDocument): EndpointMetricRow {
  return {
    id: doc.id,
    test_id: doc.testId,
    url: doc.url,
    metric: JSON.stringify(doc.metric),
    epoch: doc.epoch,
  };
}

class EndpointMetricCollection {
  async getAll(): Promise<EndpointMetricDocument[]> {
    try {
      const rows = await db
        .selectFrom('endpoint_metrics')
        .selectAll()
        .execute();
      return rows.map(mapEndpointMetricFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve endpoint metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getById(id: string): Promise<EndpointMetricDocument | undefined> {
    try {
      const row = await db
        .selectFrom('endpoint_metrics')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
      return row ? mapEndpointMetricFromDb(row) : undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve endpoint metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getByTestId(testId: string): Promise<EndpointMetricDocument[]> {
    try {
      const rows = await db
        .selectFrom('endpoint_metrics')
        .where('test_id', '=', testId)
        .selectAll()
        .execute();
      return rows.map(mapEndpointMetricFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve endpoint metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getByUrl(url: string): Promise<EndpointMetricDocument[]> {
    try {
      const rows = await db
        .selectFrom('endpoint_metrics')
        .where('url', '=', url)
        .selectAll()
        .execute();
      return rows.map(mapEndpointMetricFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve endpoint metrics for URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async create(input: EndpointMetricCreate): Promise<EndpointMetricDocument> {
    try {
      const metricDoc: EndpointMetricDocument = {
        id: crypto.randomUUID(),
        testId: input.testId,
        url: input.url,
        metric: input.metric,
        epoch: input.epoch,
      };
      await db
        .insertInto('endpoint_metrics')
        .values(mapEndpointMetricToDb(metricDoc))
        .execute();
      return metricDoc;
    } catch (error) {
      throw new Error(
        `Failed to create endpoint metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        .deleteFrom('endpoint_metrics')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      throw new Error(
        `Failed to delete endpoint metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteByTestId(testId: string): Promise<number> {
    try {
      const result = await db
        .deleteFrom('endpoint_metrics')
        .where('test_id', '=', testId)
        .executeTakeFirst();
      return Number(result.numDeletedRows || 0);
    } catch (error) {
      throw new Error(
        `Failed to delete endpoint metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getLastByTestId(
    testId: string,
  ): Promise<Record<string, EndpointMetricDocument>> {
    try {
      const rows = await db
        .selectFrom('endpoint_metrics')
        .where('test_id', '=', testId)
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        .select(['url', (eb) => eb.fn.max('epoch').as('max_epoch')])
        .groupBy('url')
        .execute();

      if (rows.length === 0) {
        return {};
      }

      // For each URL, fetch the full row with the max epoch
      const result: Record<string, EndpointMetricDocument> = {};
      for (const row of rows) {
        const metricRow = await db
          .selectFrom('endpoint_metrics')
          .where('test_id', '=', testId)
          .where('url', '=', row.url)
          .where('epoch', '=', row.max_epoch)
          .selectAll()
          .executeTakeFirst();
        if (metricRow) {
          result[row.url] = mapEndpointMetricFromDb(metricRow);
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

export const endpointMetricStorage = new EndpointMetricCollection();

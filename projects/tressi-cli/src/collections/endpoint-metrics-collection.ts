import { createCollectionForType } from './adapter';
import { EndpointMetricDocument } from './types';

export type EndpointMetricCreate = Pick<
  EndpointMetricDocument,
  'testId' | 'url' | 'metric' | 'epoch'
>;

/**
 * Storage class for managing endpoint-specific metrics using SignalDB
 * Provides CRUD operations for endpoint metric documents
 */
class EndpointMetricCollection {
  private readonly collection = createCollectionForType<EndpointMetricDocument>(
    'endpoint.metric.db.json',
  );

  /**
   * Get all endpoint metrics
   * @returns Array of endpoint metric documents
   */
  async getAll(): Promise<EndpointMetricDocument[]> {
    try {
      return this.collection.find({}).fetch();
    } catch (error) {
      throw new Error(
        `Failed to retrieve endpoint metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a single endpoint metric by ID
   * @param id Endpoint metric ID
   * @returns Endpoint metric document or undefined if not found
   */
  async getById(id: string): Promise<EndpointMetricDocument | undefined> {
    try {
      const docs = this.collection.find({ id }).fetch();
      return docs[0] || undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve endpoint metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all endpoint metrics for a specific test
   * @param testId Test run ID
   * @returns Array of endpoint metric documents for the test
   */
  async getByTestId(testId: string): Promise<EndpointMetricDocument[]> {
    try {
      return this.collection.find({ testId }).fetch();
    } catch (error) {
      throw new Error(
        `Failed to retrieve endpoint metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all endpoint metrics for a specific URL
   * @param url Endpoint URL
   * @returns Array of endpoint metric documents for the URL
   */
  async getByUrl(url: string): Promise<EndpointMetricDocument[]> {
    try {
      return this.collection.find({ url }).fetch();
    } catch (error) {
      throw new Error(
        `Failed to retrieve endpoint metrics for URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a new endpoint metric
   * @param input Endpoint metric data
   * @returns Created endpoint metric document
   */
  async create(input: EndpointMetricCreate): Promise<EndpointMetricDocument> {
    try {
      const metricDoc: EndpointMetricDocument = {
        id: crypto.randomUUID(),
        testId: input.testId,
        url: input.url,
        metric: input.metric,
        epoch: input.epoch,
      };
      this.collection.insert(metricDoc);
      return metricDoc;
    } catch (error) {
      throw new Error(
        `Failed to create endpoint metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete an endpoint metric by ID
   * @param id Endpoint metric ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        return false;
      }

      const result = this.collection.removeOne({ id });
      return result > 0;
    } catch (error) {
      throw new Error(
        `Failed to delete endpoint metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete all endpoint metrics for a specific test
   * @param testId Test run ID
   * @returns Number of deleted documents
   */
  async deleteByTestId(testId: string): Promise<number> {
    try {
      const result = this.collection.removeMany({ testId });
      return result;
    } catch (error) {
      throw new Error(
        `Failed to delete endpoint metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get the last endpoint metrics for a specific test
   * @param testId Test run ID
   * @returns Object mapping URLs to their last endpoint metric, or empty object if not found
   */
  async getLastByTestId(
    testId: string,
  ): Promise<Record<string, EndpointMetricDocument>> {
    try {
      const metrics = await this.getByTestId(testId);
      if (metrics.length === 0) {
        return {};
      }

      // Group by URL and find the last metric for each
      const lastByUrl = new Map<string, EndpointMetricDocument>();

      for (const metric of metrics) {
        const existing = lastByUrl.get(metric.url);
        if (!existing || metric.epoch > existing.epoch) {
          lastByUrl.set(metric.url, metric);
        }
      }

      // Convert Map to plain object
      const result: Record<string, EndpointMetricDocument> = {};
      for (const [url, metric] of lastByUrl) {
        result[url] = metric;
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to retrieve last endpoint metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Global endpoint metric storage instance
 */
export const endpointMetricStorage = new EndpointMetricCollection();

import { EndpointMetric } from 'tressi-common/metrics';

import { createCollectionForType } from './adapter';
import { GlobalMetricDocument } from './types';

export type GlobalMetricCreate = Pick<
  GlobalMetricDocument,
  'testId' | 'configId' | 'metric' | 'epoch'
>;

/**
 * Storage class for managing global metrics using SignalDB
 * Provides CRUD operations for global metric documents
 */
class GlobalMetricCollection {
  private readonly collection = createCollectionForType<GlobalMetricDocument>(
    'global.metrics.db.json',
  );

  /**
   * Get all global metrics
   * @returns Array of global metric documents
   */
  async getAll(): Promise<GlobalMetricDocument[]> {
    try {
      return this.collection.find({ type: 'global-metric' }).fetch();
    } catch (error) {
      throw new Error(
        `Failed to retrieve global metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a single global metric by ID
   * @param id Global metric ID
   * @returns Global metric document or undefined if not found
   */
  async getById(id: string): Promise<GlobalMetricDocument | undefined> {
    try {
      const docs = this.collection.find({ id, type: 'global-metric' }).fetch();
      return docs[0] || undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve global metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all global metrics for a specific test
   * @param testId Test run ID
   * @returns Array of global metric documents for the test
   */
  async getByTestId(testId: string): Promise<GlobalMetricDocument[]> {
    try {
      return this.collection.find({ testId, type: 'global-metric' }).fetch();
    } catch (error) {
      throw new Error(
        `Failed to retrieve global metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a new global metric
   * @param input Global metric data
   * @returns Created global metric document
   */
  async create(input: GlobalMetricCreate): Promise<GlobalMetricDocument> {
    try {
      const metricDoc = this.transformToGlobalMetricDocument(input);
      this.collection.insert(metricDoc);
      return metricDoc;
    } catch (error) {
      throw new Error(
        `Failed to create global metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a global metric by ID
   * @param id Global metric ID
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
        `Failed to delete global metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete all global metrics for a specific test
   * @param testId Test run ID
   * @returns Number of deleted documents
   */
  async deleteByTestId(testId: string): Promise<number> {
    try {
      const result = this.collection.removeMany({
        testId,
        type: 'global-metric',
      });
      return result;
    } catch (error) {
      throw new Error(
        `Failed to delete global metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Transforms global metric data to GlobalMetricDocument format
   * @param input Global metric data
   * @returns GlobalMetricDocument with proper structure
   */
  private transformToGlobalMetricDocument(input: {
    id?: string;
    testId: string;
    configId: string;
    metric: EndpointMetric;
    epoch: number;
  }): GlobalMetricDocument {
    return {
      id: input.id || crypto.randomUUID(),
      type: 'global-metric',
      testId: input.testId,
      configId: input.configId,
      metric: input.metric,
      epoch: input.epoch,
    };
  }
}

/**
 * Global global metric storage instance
 */
export const globalMetricStorage = new GlobalMetricCollection();

import { createCollectionForType } from './adapter';
import { GlobalMetricDocument } from './types';

export type GlobalMetricCreate = Pick<
  GlobalMetricDocument,
  'testId' | 'metric' | 'epoch'
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
      return this.collection.find({}).fetch();
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
      const docs = this.collection.find({ id }).fetch();
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
      return this.collection.find({ testId }).fetch();
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
      const metricDoc: GlobalMetricDocument = {
        id: crypto.randomUUID(),
        testId: input.testId,
        metric: input.metric,
        epoch: input.epoch,
      };
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
      const result = this.collection.removeMany({ testId });
      return result;
    } catch (error) {
      throw new Error(
        `Failed to delete global metrics for test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Global global metric storage instance
 */
export const globalMetricStorage = new GlobalMetricCollection();

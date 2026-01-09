import { createCollectionForType } from './adapter';
import { TestDocument } from './types';

export type TestCreate = Pick<TestDocument, 'configId'>;

export type TestEdit = Pick<TestDocument, 'id' | 'configId'> &
  Partial<
    Pick<
      TestDocument,
      'status' | 'epochStartedAt' | 'epochEndedAt' | 'error' | 'summary'
    >
  >;

/**
 * Storage class for managing test runs using SignalDB
 * Provides CRUD operations for test documents
 */
class TestCollection {
  private readonly collection =
    createCollectionForType<TestDocument>('test.db.json');

  /**
   * Get all test runs
   * @returns Array of test documents
   */
  async getAll(): Promise<TestDocument[]> {
    try {
      return this.collection.find({}).fetch();
    } catch (error) {
      throw new Error(
        `Failed to retrieve test runs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a single test run by ID
   * @param id Test ID
   * @returns Test document or undefined if not found
   */
  async getById(id: string): Promise<TestDocument | undefined> {
    try {
      const docs = this.collection.find({ id }).fetch();
      return docs[0] || undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve test run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a new test run
   * @param input Test data
   * @returns Created test document
   */
  async create(input: TestCreate): Promise<TestDocument> {
    try {
      const now = Date.now();
      const testDoc: TestDocument = {
        id: crypto.randomUUID(),
        configId: input.configId,
        status: null,
        epochCreatedAt: now,
        epochStartedAt: null,
        epochUpdatedAt: now,
        epochEndedAt: null,
        error: null,
        summary: null,
      };
      this.collection.insert(testDoc);
      return testDoc;
    } catch (error) {
      throw new Error(
        `Failed to create test run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Edit an existing test run
   * @param input Test data with ID
   * @returns Updated test document
   * @throws Error if test run with given ID is not found
   */
  async edit(input: TestEdit): Promise<TestDocument> {
    try {
      const existing = await this.getById(input.id);

      if (!existing) {
        throw new Error(`Test run with ID ${input.id} not found`);
      }

      // Only update provided fields, preserve existing values for missing fields
      const updatedDoc: TestDocument = {
        ...existing,
        configId: input.configId ?? existing.configId,
        status: input.status ?? existing.status,
        epochStartedAt: input.epochStartedAt ?? existing.epochStartedAt,
        epochEndedAt: input.epochEndedAt ?? existing.epochEndedAt,
        error: input.error ?? existing.error,
        epochUpdatedAt: Date.now(),
        summary: input.summary ?? existing.summary,
      };

      this.collection.updateOne({ id: input.id }, { $set: updatedDoc });

      return updatedDoc;
    } catch (error) {
      throw new Error(
        `Failed to edit test run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a test run by ID
   * @param id Test ID
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
        `Failed to delete test run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Global test storage instance
 */
export const testStorage = new TestCollection();

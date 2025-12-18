import { TestDocument } from '../types/db/types';
import { createCollectionForType } from './adapter';

export type TestCreate = Pick<
  TestDocument,
  'configId' | 'status' | 'epochStartedAt'
>;

export type TestEdit = Pick<
  TestDocument,
  'id' | 'configId' | 'status' | 'epochStartedAt'
> &
  Partial<Pick<TestDocument, 'epochEndedAt' | 'error'>>;

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
      return this.collection.find({ type: 'test' }).fetch();
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
      const docs = this.collection.find({ id, type: 'test' }).fetch();
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
      const testDoc = this.transformToTestDocument(input);
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

      const testDoc = this.transformToTestDocument(input);
      const updatedDoc = {
        ...existing,
        ...testDoc,
        epochCreatedAt: existing.epochCreatedAt, // Preserve original creation time
        epochUpdatedAt: Date.now(),
      };

      this.collection.removeOne({ id: input.id });
      this.collection.insert(updatedDoc);
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

  /**
   * Transforms test data to TestDocument format
   * @param input Test data
   * @returns TestDocument with proper structure
   */
  private transformToTestDocument(input: {
    id?: string;
    configId: string;
    status: 'running' | 'completed' | 'failed';
    epochStartedAt: number;
    epochEndedAt?: number;
    error?: string;
  }): TestDocument {
    const now = Date.now();
    return {
      id: input.id || crypto.randomUUID(),
      type: 'test',
      configId: input.configId,
      status: input.status,
      epochStartedAt: input.epochStartedAt,
      epochEndedAt: input.epochEndedAt,
      error: input.error,
      epochCreatedAt: now,
      epochUpdatedAt: now,
    };
  }
}

/**
 * Global test storage instance
 */
export const testStorage = new TestCollection();

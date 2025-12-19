import { createCollectionForType } from './adapter';
import { ConfigDocument } from './types';

export type ConfigCreate = Pick<ConfigDocument, 'name' | 'config'>;

export type ConfigEdit = Pick<ConfigDocument, 'id' | 'name' | 'config'>;

/**
 * Storage class for managing Tressi configurations using SignalDB
 * Provides CRUD operations for configuration documents
 */
class ConfigCollection {
  private readonly collection =
    createCollectionForType<ConfigDocument>('config.db.json');

  /**
   * Get all saved configurations
   * @returns Array of configuration documents
   */
  async getAll(): Promise<ConfigDocument[]> {
    try {
      return this.collection.find({}).fetch();
    } catch (error) {
      throw new Error(
        `Failed to retrieve configurations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a single configuration by ID
   * @param id Configuration ID
   * @returns Configuration document or undefined if not found
   */
  async getById(id: string): Promise<ConfigDocument | undefined> {
    try {
      const docs = this.collection.find({ id }).fetch();
      return docs[0] || undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a new configuration
   * @param input Configuration data
   * @returns Created configuration document
   */
  async create(input: ConfigCreate): Promise<ConfigDocument> {
    try {
      const now = Date.now();
      const configDoc: ConfigDocument = {
        id: crypto.randomUUID(),
        name: input.name,
        config: input.config,
        epochCreatedAt: now,
        epochUpdatedAt: now,
      };
      this.collection.insert(configDoc);
      return configDoc;
    } catch (error) {
      throw new Error(
        `Failed to create configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Edit an existing configuration
   * @param input Configuration data with ID
   * @returns Updated configuration document
   * @throws Error if configuration with given ID is not found
   */
  async edit(input: ConfigEdit): Promise<ConfigDocument> {
    try {
      const existing = await this.getById(input.id);
      if (!existing) {
        throw new Error(`Configuration with ID ${input.id} not found`);
      }

      // Only update provided fields, preserve existing values for missing fields
      const updatedDoc = {
        ...existing,
        name: input.name ?? existing.name,
        config: input.config ?? existing.config,
        epochUpdatedAt: Date.now(),
      };

      this.collection.updateOne({ id: input.id }, { $set: updatedDoc });

      return updatedDoc;
    } catch (error) {
      throw new Error(
        `Failed to edit configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a configuration by ID
   * @param id Configuration ID
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
        `Failed to delete configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Global configuration storage instance
 */
export const configStorage = new ConfigCollection();

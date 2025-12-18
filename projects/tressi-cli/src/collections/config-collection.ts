import { TressiConfig } from 'tressi-common/config';

import { ConfigDocument } from '../types/db/types';
import { createCollectionForType } from './adapter';

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
      return this.collection.find({ type: 'config' }).fetch();
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
      const docs = this.collection.find({ id, type: 'config' }).fetch();
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
      const configDoc = this.transformToConfigDocument(input);
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

      const configDoc = this.transformToConfigDocument(input);
      const updatedDoc = {
        ...existing,
        ...configDoc,
        epochCreatedAt: existing.epochCreatedAt, // Preserve original creation time
        epochUpdatedAt: Date.now(),
      };

      this.collection.removeOne({ id: input.id });
      this.collection.insert(updatedDoc);
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

  /**
   * Transforms configuration data to ConfigDocument format
   * @param input Configuration data
   * @returns ConfigDocument with proper structure
   */
  private transformToConfigDocument(input: {
    id?: string;
    name: string;
    config: TressiConfig;
  }): ConfigDocument {
    const now = Date.now();
    return {
      id: input.id || crypto.randomUUID(),
      type: 'config',
      name: input.name,
      config: input.config,
      epochCreatedAt: now,
      epochUpdatedAt: now,
    };
  }
}

/**
 * Global configuration storage instance
 */
export const configStorage = new ConfigCollection();

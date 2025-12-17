import { TressiConfig } from 'tressi-common/config';

import { ConfigDocument } from '../types/db/types';
import { configCollection } from './signaldb-adapter';

export type ConfigUpsert = Pick<ConfigDocument, 'name' | 'config'> &
  Partial<Pick<ConfigDocument, 'id'>>;

/**
 * Storage class for managing Tressi configurations using SignalDB
 * Provides CRUD operations for configuration documents
 */
export class ConfigStorage {
  /**
   * Get all saved configurations
   * @returns Array of configuration documents
   */
  async getAll(): Promise<ConfigDocument[]> {
    try {
      return configCollection.find({ type: 'config' }).fetch();
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
      const docs = configCollection.find({ id, type: 'config' }).fetch();
      return docs[0] || undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Save a new configuration or update existing one
   * @param input Configuration data
   * @returns Saved configuration document
   */
  async save(input: ConfigUpsert): Promise<ConfigDocument> {
    try {
      const configDoc = this.transformToConfigDocument(input);

      // Check if this is an update by ID
      if (input.id) {
        const existing = await this.getById(input.id);
        if (existing) {
          // Update existing document
          const updatedDoc = {
            ...existing,
            ...configDoc,
            createdAt: existing.epochCreatedAt, // Preserve original creation time
            updatedAt: Date.now(),
          };
          configCollection.removeOne({ id: input.id });
          configCollection.insert(updatedDoc);
          return updatedDoc;
        }
      }

      // Insert new configuration
      configCollection.insert(configDoc);
      return configDoc;
    } catch (error) {
      throw new Error(
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

      const result = configCollection.removeOne({ id });
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
export const configStorage = new ConfigStorage();

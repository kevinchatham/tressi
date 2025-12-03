import { existsSync, mkdirSync } from 'fs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { homedir } from 'os';
import { join } from 'path';
import {
  ConfigMetadataApiResponse,
  ConfigRecordApiResponse,
} from 'tressi-common/api';
import type { SafeTressiConfig } from 'tressi-common/config';

import { ConfigDatabase } from '../types/db/types';

const configDir = join(homedir(), '.tressi');
const configPath = join(configDir, 'configs.json');

// Ensure config directory exists
if (!existsSync(configDir)) {
  mkdirSync(configDir, { recursive: true });
}

// Initialize LowDB
const adapter = new JSONFile<ConfigDatabase>(configPath);
const db = new Low(adapter, { configs: [] });

export class ConfigStorage {
  /**
   * Get all saved configurations (without the full config data)
   */
  async getAllMetadata(): Promise<ConfigMetadataApiResponse[]> {
    await db.read();
    return db.data.configs.map(({ id, name, createdAt, updatedAt }) => ({
      id,
      name,
      createdAt,
      updatedAt,
    }));
  }

  /**
   * Get a single configuration by ID
   */
  async getById(id: string): Promise<ConfigRecordApiResponse | undefined> {
    await db.read();
    return db.data.configs.find((c) => c.id === id);
  }

  /**
   * Get a configuration by name
   */
  async getByName(name: string): Promise<ConfigRecordApiResponse | undefined> {
    await db.read();
    return db.data.configs.find((c) => c.name === name);
  }

  /**
   * Save a new configuration or update existing one by name
   */
  async save(
    name: string,
    config: SafeTressiConfig,
  ): Promise<ConfigRecordApiResponse> {
    await db.read();

    const existingIndex = db.data.configs.findIndex((c) => c.name === name);
    const now = Date.now();

    if (existingIndex !== -1) {
      // Update existing
      db.data.configs[existingIndex] = {
        ...db.data.configs[existingIndex],
        config,
        updatedAt: now,
      };
    } else {
      // Create new
      const newConfig: ConfigRecordApiResponse = {
        id: `config_${now}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        config,
        createdAt: now,
        updatedAt: now,
      };
      db.data.configs.push(newConfig);
    }

    await db.write();
    return db.data.configs.find((c) => c.name === name)!;
  }

  /**
   * Delete a configuration by ID
   */
  async delete(id: string): Promise<boolean> {
    await db.read();
    const initialLength = db.data.configs.length;
    db.data.configs = db.data.configs.filter((c) => c.id !== id);

    if (db.data.configs.length < initialLength) {
      await db.write();
      return true;
    }

    return false;
  }

  /**
   * Delete a configuration by name
   */
  async deleteByName(name: string): Promise<boolean> {
    await db.read();
    const initialLength = db.data.configs.length;
    db.data.configs = db.data.configs.filter((c) => c.name !== name);

    if (db.data.configs.length < initialLength) {
      await db.write();
      return true;
    }

    return false;
  }
}

export const configStorage = new ConfigStorage();

import { existsSync, mkdirSync } from 'fs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { homedir } from 'os';
import { join } from 'path';

import {
  ConfigRequestInferType,
  ConfigRequestOutputType,
  ConfigRequestSchema,
} from '../server/routes/configs';
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
  async getAllMetadata(): Promise<ConfigRequestOutputType[]> {
    await db.read();
    return db.data.configs;
  }

  /**
   * Get a single configuration by ID
   */
  async getById(id: string): Promise<ConfigRequestOutputType | undefined> {
    await db.read();
    return db.data.configs.find((c) => c.id === id);
  }

  /**
   * Get a configuration by name
   */
  async getByName(name: string): Promise<ConfigRequestOutputType | undefined> {
    await db.read();
    return db.data.configs.find((c) => c.name === name);
  }

  /**
   * Save a new configuration or update existing one by name
   */
  async save(input: ConfigRequestInferType): Promise<ConfigRequestOutputType> {
    await db.read();

    const existingIndex = db.data.configs.findIndex((c) => c.id === input.id);

    const model = ConfigRequestSchema.parse(input);

    if (existingIndex !== -1) {
      db.data.configs[existingIndex] = model;
    } else {
      db.data.configs.push(model);
    }

    await db.write();
    return db.data.configs.find((c) => c.name === input.name)!;
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

import { db } from '../database/db';
import { ConfigRow } from '../database/schema';
import { ConfigDocument } from './types';

export type ConfigCreate = Pick<ConfigDocument, 'name' | 'config'>;
export type ConfigEdit = Pick<ConfigDocument, 'id' | 'name' | 'config'>;

function mapConfigFromDb(row: ConfigRow): ConfigDocument {
  return {
    id: row.id,
    name: row.name,
    config: JSON.parse(row.config),
    epochCreatedAt: row.epoch_created_at,
    epochUpdatedAt: row.epoch_updated_at,
  };
}

function mapConfigToDb(doc: ConfigDocument): ConfigRow {
  return {
    id: doc.id,
    name: doc.name,
    config: JSON.stringify(doc.config),
    epoch_created_at: doc.epochCreatedAt,
    epoch_updated_at: doc.epochUpdatedAt,
  };
}

class ConfigCollection {
  async getAll(): Promise<ConfigDocument[]> {
    try {
      const rows = await db.selectFrom('configs').selectAll().execute();
      return rows.map(mapConfigFromDb);
    } catch (error) {
      throw new Error(
        `Failed to retrieve configurations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getById(id: string): Promise<ConfigDocument | undefined> {
    try {
      const row = await db
        .selectFrom('configs')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
      return row ? mapConfigFromDb(row) : undefined;
    } catch (error) {
      throw new Error(
        `Failed to retrieve configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

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
      await db.insertInto('configs').values(mapConfigToDb(configDoc)).execute();
      return configDoc;
    } catch (error) {
      throw new Error(
        `Failed to create configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async edit(input: ConfigEdit): Promise<ConfigDocument> {
    try {
      const existing = await this.getById(input.id);
      if (!existing) {
        throw new Error(`Configuration with ID ${input.id} not found`);
      }

      const updatedDoc: ConfigDocument = {
        ...existing,
        name: input.name ?? existing.name,
        config: input.config ?? existing.config,
        epochUpdatedAt: Date.now(),
      };

      await db
        .updateTable('configs')
        .set(mapConfigToDb(updatedDoc))
        .where('id', '=', input.id)
        .execute();

      return updatedDoc;
    } catch (error) {
      throw new Error(
        `Failed to edit configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        return false;
      }

      const result = await db
        .deleteFrom('configs')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      throw new Error(
        `Failed to delete configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export const configStorage = new ConfigCollection();

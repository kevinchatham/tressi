import { Collection, PersistenceAdapter } from '@signaldb/core';
import createFilesystemAdapter from '@signaldb/fs';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const rootDir = join(homedir(), '.tressi');

/**
 * Creates a filesystem adapter for a specific document type
 */
function createFilesystemAdapterForType<T extends { id: string }>(
  dbPath: string,
): PersistenceAdapter<T, string> {
  return createFilesystemAdapter<T, string>(dbPath, {
    serialize: (data: T[]): string => {
      try {
        return JSON.stringify(data, null, 2);
      } catch (error) {
        throw new Error(
          `Serialization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
    deserialize: (data: string): T[] => {
      try {
        return JSON.parse(data);
      } catch (error) {
        throw new Error(
          `Deserialization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  });
}

/**
 * Creates a collection for a specific document type
 */
export function createCollectionForType<T extends { id: string }>(
  dbPath: string,
): Collection<T, string> {
  // Ensure config directory exists
  if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true });
  const path = join(rootDir, dbPath);
  return new Collection<T, string>({
    persistence: createFilesystemAdapterForType<T>(path),
  });
}

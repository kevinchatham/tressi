import { Collection, PersistenceAdapter } from '@signaldb/core';
import createFilesystemAdapter from '@signaldb/fs';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import {
  ConfigDocument,
  EndpointMetricDocument,
  GlobalMetricDocument,
  TestDocument,
} from '../types/db/types';

const configDir = join(homedir(), '.tressi');

// Database file paths for each collection type
const configDbPath = join(configDir, 'config.db.json');
const testDbPath = join(configDir, 'test.db.json');
const globalMetricDbPath = join(configDir, 'global.metrics.db.json');
const endpointMetricDbPath = join(configDir, 'endpoint.metric.db.json');

// Ensure config directory exists
if (!existsSync(configDir)) {
  mkdirSync(configDir, { recursive: true });
}

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

// Create filesystem adapters for each collection type
const configFilesystemAdapter =
  createFilesystemAdapterForType<ConfigDocument>(configDbPath);
const testFilesystemAdapter =
  createFilesystemAdapterForType<TestDocument>(testDbPath);
const globalMetricFilesystemAdapter =
  createFilesystemAdapterForType<GlobalMetricDocument>(globalMetricDbPath);
const endpointMetricFilesystemAdapter =
  createFilesystemAdapterForType<EndpointMetricDocument>(endpointMetricDbPath);

/**
 * Creates a SignalDB collection for configuration documents
 * @returns Collection instance for configuration documents
 */
export function createConfigCollection(): Collection<ConfigDocument, string> {
  return new Collection<ConfigDocument, string>({
    persistence: configFilesystemAdapter,
  });
}

/**
 * Creates a SignalDB collection for test documents
 * @returns Collection instance for test documents
 */
export function createTestCollection(): Collection<TestDocument, string> {
  return new Collection<TestDocument, string>({
    persistence: testFilesystemAdapter,
  });
}

/**
 * Creates a SignalDB collection for global metric documents
 * @returns Collection instance for global metric documents
 */
export function createGlobalMetricCollection(): Collection<
  GlobalMetricDocument,
  string
> {
  return new Collection<GlobalMetricDocument, string>({
    persistence: globalMetricFilesystemAdapter,
  });
}

/**
 * Creates a SignalDB collection for endpoint metric documents
 * @returns Collection instance for endpoint metric documents
 */
export function createEndpointMetricCollection(): Collection<
  EndpointMetricDocument,
  string
> {
  return new Collection<EndpointMetricDocument, string>({
    persistence: endpointMetricFilesystemAdapter,
  });
}

// Collection singletons for the application
export const configCollection = createConfigCollection();
export const testCollection = createTestCollection();
export const globalMetricCollection = createGlobalMetricCollection();
export const endpointMetricCollection = createEndpointMetricCollection();

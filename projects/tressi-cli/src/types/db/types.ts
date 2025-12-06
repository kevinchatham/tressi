import { TressiConfig } from 'tressi-common/config';

export type ConfigDatabase = {
  configs: ConfigRecordApiResponse[];
};

/**
 * Complete configuration record with metadata and full config
 */
export type ConfigRecordApiResponse = ConfigMetadataApiResponse & {
  config: TressiConfig;
};

/**
 * Configuration metadata without full config data
 */
export type ConfigMetadataApiResponse = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

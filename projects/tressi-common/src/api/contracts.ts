import { SafeTressiConfig } from '../config';

/**
 * Health check response
 */
export type HealthApiResponse = {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
};

/**
 * Error response structure
 */
export type ErrorApiResponse = {
  error: {
    message: string;
    code?: string;
    details?: string[];
    timestamp: string;
    path?: string;
  };
};

/**
 * Validation error response with detailed field errors
 */
export type ValidationErrorApiResponse = {
  error: {
    message: string;
    code: 'VALIDATION_ERROR';
    details: string[];
    timestamp: string;
    path?: string;
  };
};

/**
 * Load test execution response
 */
export type LoadTestApiResponse = {
  status: 'accepted' | 'rejected';
  message: string;
  jobId?: string;
};

/**
 * Current job status
 */
export type JobStatusApiResponse = {
  isRunning: boolean;
  jobId?: string;
  status?: 'running' | 'completed' | 'failed';
  error?: string;
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

/**
 * Complete configuration record with metadata and full config
 */
export type ConfigRecordApiResponse = ConfigMetadataApiResponse & {
  config: SafeTressiConfig;
};

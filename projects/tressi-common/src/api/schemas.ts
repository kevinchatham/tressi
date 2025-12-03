import z from 'zod';

import { TressiConfigSchema } from '../config/schemas';

/**
 * Request schema for saving a configuration
 */
export const SaveConfigRequestSchema = z.object({
  name: z.string(),
  config: TressiConfigSchema,
});

/**
 * Request schema for starting a load test
 */
export const LoadTestRequestSchema = TressiConfigSchema;

/**
 * Request schema for health check (no body required)
 */
export const HealthCheckRequestSchema = z.object({});

/**
 * Request schema for getting job status (no body required)
 */
export const JobStatusRequestSchema = z.object({});

/**
 * Request schema for getting all configurations (no body required)
 */
export const GetAllConfigsRequestSchema = z.object({});

/**
 * Request schema for getting a specific configuration
 */
export const GetConfigRequestSchema = z.object({});

/**
 * Request schema for deleting a configuration
 */
export const DeleteConfigRequestSchema = z.object({});

/**
 * Request schema for metrics streaming (no body required)
 */
export const MetricsStreamRequestSchema = z.object({});

/**
 * Inferred TypeScript types from schemas
 */
export type SaveConfigRequest = z.infer<typeof SaveConfigRequestSchema>;
export type LoadTestRequest = z.infer<typeof LoadTestRequestSchema>;
export type HealthCheckRequest = z.infer<typeof HealthCheckRequestSchema>;
export type JobStatusRequest = z.infer<typeof JobStatusRequestSchema>;
export type GetAllConfigsRequest = z.infer<typeof GetAllConfigsRequestSchema>;
export type GetConfigRequest = z.infer<typeof GetConfigRequestSchema>;
export type DeleteConfigRequest = z.infer<typeof DeleteConfigRequestSchema>;
export type MetricsStreamRequest = z.infer<typeof MetricsStreamRequestSchema>;

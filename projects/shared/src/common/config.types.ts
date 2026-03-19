import type { ZodError, z } from 'zod';

import type {
  EarlyExitConfigSchema,
  TressiConfigSchema,
  TressiOptionsConfigSchema,
  TressiRequestConfigSchema,
} from './schema.data';

/**
 * Result of configuration validation.
 */
export type ConfigValidationResult =
  | {
      success: false;
      error: ZodError;
    }
  | {
      success: true;
      data: TressiConfig;
    };

/**
 * Standard error response for API endpoints.
 */
export type ErrorApiResponse = {
  error: {
    message: string;
    code?: string;
    details?: string[];
    timestamp: number;
    path?: string;
  };
};

/**
 * Type representing early exit configuration.
 */
export type TressiEarlyExitConfig = z.output<typeof EarlyExitConfigSchema>;

/**
 * Type representing the Tressi configuration.
 */
export type TressiConfig = z.output<typeof TressiConfigSchema>;

/**
 * Type representing the options configuration.
 */
export type TressiOptionsConfig = z.output<typeof TressiOptionsConfigSchema>;

/**
 * Type representing a single request configuration.
 */
export type TressiRequestConfig = z.output<typeof TressiRequestConfigSchema>;

/**
 * Request body for creating or editing a configuration.
 */
export type SaveConfigRequest = {
  id?: string;
  name: string;
  config: TressiConfig;
};

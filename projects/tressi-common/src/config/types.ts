import type { z } from 'zod';

import type {
  EarlyExitConfigSchema,
  TressiConfigSchema,
  TressiOptionsConfigSchema,
  TressiRequestConfigSchema,
} from './schemas.js';

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

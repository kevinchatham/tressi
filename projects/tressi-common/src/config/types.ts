import type { z } from 'zod';

import type {
  TressiConfigSchema,
  TressiOptionsConfigSchema,
  TressiRequestConfigSchema,
} from './schemas.js';

/**
 * Type representing the Tressi configuration.
 */
export type TressiConfig = z.infer<typeof TressiConfigSchema>;

/**
 * Type representing the options configuration.
 */
export type TressiOptionsConfig = z.infer<typeof TressiOptionsConfigSchema>;

/**
 * Type representing a single request configuration.
 */
export type TressiRequestConfig = z.infer<typeof TressiRequestConfigSchema>;

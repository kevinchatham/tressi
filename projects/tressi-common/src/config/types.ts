import type { z } from 'zod';

import type {
  TressiConfigSchema,
  TressiOptionsConfigSchema,
  TressiRequestConfigSchema,
} from './schemas.js';

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
export type TressiRequestConfig = z.input<typeof TressiRequestConfigSchema>;

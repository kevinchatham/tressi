import { TressiConfigSchema } from './schemas';
import { TressiConfig } from './types';

/**
 * Default Tressi configuration with sample requests.
 * This configuration provides a starting point for new users.
 */
export const defaultTressiConfig: TressiConfig = ((): TressiConfig =>
  TressiConfigSchema.parse({}))();

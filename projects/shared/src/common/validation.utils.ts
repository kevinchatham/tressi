import type { ConfigValidationResult } from './config.types';
import { TressiConfigSchema } from './schema.data';

export function validateConfig(rawContent: unknown): ConfigValidationResult {
  const parseResult = TressiConfigSchema.safeParse(rawContent);

  if (!parseResult.success) {
    return {
      error: parseResult.error,
      success: false,
    };
  }

  return {
    data: parseResult.data,
    success: true,
  };
}

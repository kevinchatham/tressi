import { ConfigValidationResult } from './config.types';
import { TressiConfigSchema } from './schema.data';

export function validateConfig(rawContent: unknown): ConfigValidationResult {
  const parseResult = TressiConfigSchema.safeParse(rawContent);

  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
    };
  }

  return {
    success: true,
    data: parseResult.data,
  };
}

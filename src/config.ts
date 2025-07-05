import jiti from 'jiti';
import path from 'path';
import { z } from 'zod';

const RequestConfigSchema = z.object({
  url: z.string().url(),
  payload: z
    .record(z.string(), z.unknown())
    .or(z.array(z.unknown()))
    .optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
});

const TressiConfigSchema = z.object({
  headers: z.record(z.string(), z.string()).optional(),
  requests: z.array(RequestConfigSchema),
});

export type TressiConfig = z.infer<typeof TressiConfigSchema>;
export type RequestConfig = z.infer<typeof RequestConfigSchema>;

export function defineConfig(config: TressiConfig): TressiConfig {
  return config;
}

export async function loadConfig(
  configInput: string | TressiConfig,
): Promise<TressiConfig> {
  if (typeof configInput === 'object') {
    return TressiConfigSchema.parse(configInput);
  }

  let rawContent: unknown;
  if (configInput.startsWith('http://') || configInput.startsWith('https://')) {
    const res = await fetch(configInput);
    if (!res.ok) throw new Error(`Remote config fetch failed: ${res.status}`);
    rawContent = await res.json();
  } else {
    const absolutePath = path.resolve(configInput);
    const _jiti = jiti(__filename);
    const module = _jiti(absolutePath);
    rawContent = module.default || module;
  }
  return TressiConfigSchema.parse(rawContent);
}

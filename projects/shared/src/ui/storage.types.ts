/** biome-ignore-all lint/nursery/useExplicitType: zod */
import { z } from 'zod';

import type { ConfigDocument } from '../common';
import type { FieldPath, Theme } from './index';

/**
 * Schema for column configuration in the test list
 */
export const ColumnConfigSchema = z.object({
  draggable: z.boolean().optional(),
  field: z.custom<FieldPath>(),
  format: z
    .enum(['number', 'percentage', 'milliseconds', 'datetime', 'duration', 'bytes', 'bytesPerSec'])
    .optional(),
  group: z.enum([
    'basic',
    'latency',
    'request',
    'network',
    'configuration',
    'metadata',
    'performance',
  ]),
  key: z.string(),
  label: z.string(),
  order: z.number(),
  sortable: z.boolean().optional(),
  visible: z.boolean(),
  width: z.number().optional(),
});

/**
 * Type for column configuration
 */
export type ColumnConfig = z.infer<typeof ColumnConfigSchema>;

/**
 * Schema for user preferences stored in local storage
 */
export const UserPreferencesSchema = z.object({
  columnPreferences: z.array(ColumnConfigSchema).nullable(),
  lastRoute: z.string().nullable(),
  lastSelectedConfig: z.custom<ConfigDocument | null>(),
  pwaPromptDismissed: z.boolean().optional(),
  selectedTheme: z.custom<Theme>(),
});

/**
 * Type for user preferences
 */
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

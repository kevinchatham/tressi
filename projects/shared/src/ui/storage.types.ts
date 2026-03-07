import { z } from 'zod';

import { ConfigDocument } from '../common';
import { FieldPath, Theme } from './index';

/**
 * Schema for column configuration in the test list
 */
export const ColumnConfigSchema = z.object({
  key: z.string(),
  label: z.string(),
  field: z.custom<FieldPath>(),
  format: z
    .enum([
      'number',
      'percentage',
      'milliseconds',
      'datetime',
      'duration',
      'bytes',
      'bytesPerSec',
    ])
    .optional(),
  visible: z.boolean(),
  group: z.enum([
    'basic',
    'latency',
    'request',
    'network',
    'configuration',
    'metadata',
    'performance',
  ]),
  sortable: z.boolean().optional(),
  order: z.number(),
  draggable: z.boolean().optional(),
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
  selectedTheme: z.custom<Theme>(),
  lastSelectedConfig: z.custom<ConfigDocument | null>(),
  columnPreferences: z.array(ColumnConfigSchema).nullable(),
  lastRoute: z.string().nullable(),
  pwaPromptDismissed: z.boolean().optional(),
});

/**
 * Type for user preferences
 */
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

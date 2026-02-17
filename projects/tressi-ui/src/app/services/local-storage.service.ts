import { computed, inject, Injectable, signal } from '@angular/core';
import { z } from 'zod';

import { DEFAULT_COLUMN_CONFIGS } from '../components/test-list/column-config.constants';
import { FieldPath } from '../components/test-list/column-keys.enum';
import { LogService } from './log.service';
import { ConfigDocument } from './rpc.service';
import { Theme } from './theme.service';

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

export type ColumnConfig = z.infer<typeof ColumnConfigSchema>;

export const UserPreferencesSchema = z.object({
  selectedTheme: z.custom<Theme>(),
  lastSelectedConfig: z.custom<ConfigDocument | null>(),
  columnPreferences: z.array(ColumnConfigSchema).nullable(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  /**
   * Returns a signal with current preferences
   */
  preferences = computed(() => this._preferences());

  private readonly logService = inject(LogService);

  private readonly _storageKey = 'tressi-user-preferences';

  private readonly _defaultPreferences = computed<UserPreferences>(() => {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    return {
      selectedTheme: prefersDark ? 'storm' : 'shine',
      lastSelectedConfig: null,
      columnPreferences: DEFAULT_COLUMN_CONFIGS,
    };
  });

  private readonly _preferences = signal<UserPreferences>(
    this._defaultPreferences(),
  );

  constructor() {
    this.loadPreferences();
  }

  /**
   * Saves validated preferences to localStorage
   */
  savePreferences(preferences: UserPreferences): void {
    const validated = UserPreferencesSchema.parse(preferences);
    localStorage.setItem(this._storageKey, JSON.stringify(validated));
    this._preferences.set(validated);
  }

  /**
   * Loads and validates user preferences from localStorage
   */
  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(this._storageKey);

      if (!stored) {
        this.resetPreferences();
        return;
      }

      const parsed = JSON.parse(stored);
      const result = UserPreferencesSchema.safeParse(parsed);

      if (!result.success) {
        this.logService.error(
          'Invalid user preferences in localStorage: resetting...',
          result.error,
        );
        this.resetPreferences();
        return;
      }

      this._preferences.set(result.data);
    } catch (error) {
      this.logService.error(
        'Failed to load user preferences: resetting...',
        error,
      );
      this.resetPreferences();
    }
  }

  private resetPreferences(): void {
    const stored = localStorage.getItem(this._storageKey);
    if (stored) localStorage.removeItem(this._storageKey);
    this.savePreferences(this._defaultPreferences());
  }
}

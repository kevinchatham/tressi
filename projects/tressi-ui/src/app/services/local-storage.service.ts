import { inject, Injectable, signal } from '@angular/core';
import { z } from 'zod';

import { DEFAULT_COLUMN_CONFIGS } from '../components/test-list/column-config.constants';
import { LogService } from './log.service';
import { ConfigDocument } from './rpc.service';
import { Theme } from './theme.service';

export interface ColumnConfig {
  key: string;
  label: string;
  field: string;
  format?: 'number' | 'percentage' | 'milliseconds' | 'datetime' | 'duration';
  visible: boolean;
  group: 'basic' | 'performance' | 'advanced';
  sortable?: boolean;
  order: number;
  draggable?: boolean;
}

export const UserPreferencesSchema = z.object({
  selectedTheme: z.custom<Theme>(),
  lastSelectedConfig: z.custom<ConfigDocument | null>(),
  columnPreferences: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      field: z.string(),
      format: z
        .enum(['number', 'percentage', 'milliseconds', 'datetime', 'duration'])
        .optional(),
      visible: z.boolean(),
      group: z.enum(['basic', 'performance', 'advanced']),
      sortable: z.boolean().optional(),
      order: z.number(),
      draggable: z.boolean().optional(),
    }),
  ),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private readonly STORAGE_KEY = 'tressi-user-preferences';
  private readonly logService = inject(LogService);

  private readonly preferences = signal<UserPreferences>(
    this.getDefaultPreferences(),
  );

  constructor() {
    this.loadPreferences();
  }

  /**
   * Loads and validates user preferences from localStorage
   */
  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);

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

      this.preferences.set(result.data);
    } catch (error) {
      this.logService.error(
        'Failed to load user preferences: resetting...',
        error,
      );
      this.resetPreferences();
    }
  }

  private resetPreferences(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) localStorage.removeItem(this.STORAGE_KEY);
    this.savePreferences(this.getDefaultPreferences());
  }

  /**
   * Gets default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      selectedTheme: 'dark',
      lastSelectedConfig: null,
      columnPreferences: DEFAULT_COLUMN_CONFIGS,
    };
  }

  /**
   * Saves validated preferences to localStorage
   */
  savePreferences(preferences: UserPreferences): void {
    const validated = UserPreferencesSchema.parse(preferences);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validated));
    this.preferences.set(validated);
  }

  /**
   * Returns a signal with current preferences
   */
  getPreferences(): UserPreferences {
    return this.preferences();
  }
}

import { inject, Injectable, signal } from '@angular/core';
import { z } from 'zod';

import { LogService } from './log.service';
import { ConfigDocument } from './rpc.service';
import { Theme } from './theme.service';

export const UserPreferencesSchema = z.object({
  selectedTheme: z.custom<Theme>(),
  lastSelectedConfig: z.custom<ConfigDocument | null>(),
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

import { computed, Injectable, inject, signal } from '@angular/core';
import { type UserPreferences, UserPreferencesSchema } from '@tressi/shared/ui';

import { DEFAULT_COLUMN_CONFIGS } from '../components/test-list/column-config.constants';
import { LogService } from './log.service';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  /**
   * Returns a signal with current preferences
   */
  preferences = computed(() => this._preferences());

  private readonly _logService = inject(LogService);

  private readonly _storageKey = 'tressi-user-preferences';

  private readonly _defaultPreferences = computed<UserPreferences>(() => {
    const prefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    return {
      columnPreferences: DEFAULT_COLUMN_CONFIGS,
      lastRoute: null,
      lastSelectedConfig: null,
      pwaPromptDismissed: false,
      selectedTheme: prefersDark ? 'storm' : 'shine',
    };
  });

  private readonly _preferences = signal<UserPreferences>(this._defaultPreferences());

  constructor() {
    this._loadPreferences();
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
   * Saves the last known route to localStorage
   */
  saveLastRoute(route: string): void {
    const current = this._preferences();
    this.savePreferences({ ...current, lastRoute: route });
  }

  /**
   * Dismisses the PWA install prompt
   */
  dismissPwaPrompt(): void {
    const current = this._preferences();
    this.savePreferences({ ...current, pwaPromptDismissed: true });
  }

  /**
   * Loads and validates user preferences from localStorage
   */
  private _loadPreferences(): void {
    try {
      const stored = localStorage.getItem(this._storageKey);

      if (!stored) {
        this._resetPreferences();
        return;
      }

      const parsed = JSON.parse(stored);
      const result = UserPreferencesSchema.safeParse(parsed);

      if (!result.success) {
        this._logService.error(
          'Invalid user preferences in localStorage: resetting...',
          result.error,
        );
        this._resetPreferences();
        return;
      }

      this._preferences.set(result.data);
    } catch (error) {
      this._logService.error('Failed to load user preferences: resetting...', error);
      this._resetPreferences();
    }
  }

  private _resetPreferences(): void {
    const stored = localStorage.getItem(this._storageKey);
    if (stored) localStorage.removeItem(this._storageKey);
    this.savePreferences(this._defaultPreferences());
  }
}

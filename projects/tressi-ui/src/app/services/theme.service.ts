import { inject, Injectable, signal } from '@angular/core';

import { LocalStorageService } from './localstorage.service';

export const AllThemes = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
  'caramellatte',
  'abyss',
  'silk',
] as const;

export type Theme = (typeof AllThemes)[number];

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // Signals for theme-aware colors
  public readonly primaryColor = signal<string>('');
  public readonly secondaryColor = signal<string>('');
  public readonly base100 = signal<string>(''); // Background
  public readonly base200 = signal<string>(''); // Secondary background
  public readonly base300 = signal<string>(''); // Tertiary background
  public readonly baseContent = signal<string>(''); // Main text color
  public readonly neutral = signal<string>(''); // Borders/dividers
  public readonly info = signal<string>('');
  public readonly success = signal<string>('');
  public readonly warning = signal<string>('');
  public readonly error = signal<string>('');

  private readonly localStorageService = inject(LocalStorageService);

  constructor() {
    this.loadInitialTheme();
    // Listen for theme changes (DaisyUI adds data-theme attribute)
    const observer = new MutationObserver(() => this.extractThemeColors());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  private extractThemeColors(): void {
    const computedStyle = getComputedStyle(document.documentElement);

    // Extract DaisyUI CSS variables using correct property names
    this.primaryColor.set(
      computedStyle.getPropertyValue('--color-primary').trim() || '#008FFB',
    );
    this.secondaryColor.set(
      computedStyle.getPropertyValue('--color-secondary').trim() || '#5c7cfa',
    );
    this.base100.set(
      computedStyle.getPropertyValue('--color-base-100').trim() || '#ffffff',
    );
    this.base200.set(
      computedStyle.getPropertyValue('--color-base-200').trim() || '#f9fafb',
    );
    this.base300.set(
      computedStyle.getPropertyValue('--color-base-300').trim() || '#f3f4f6',
    );
    this.baseContent.set(
      computedStyle.getPropertyValue('--color-base-content').trim() ||
        '#1f2937',
    );
    this.neutral.set(
      computedStyle.getPropertyValue('--color-neutral').trim() || '#e5e7eb',
    );
    this.info.set(
      computedStyle.getPropertyValue('--color-info').trim() || '#3b82f6',
    );
    this.success.set(
      computedStyle.getPropertyValue('--color-success').trim() || '#10b981',
    );
    this.warning.set(
      computedStyle.getPropertyValue('--color-warning').trim() || '#f59e0b',
    );
    this.error.set(
      computedStyle.getPropertyValue('--color-error').trim() || '#ef4444',
    );
  }

  // Get chart colors based on theme
  public getChartColors(): {
    primary: string;
    secondary: string;
    background: string;
    grid: string;
    text: string;
    border: string;
  } {
    return {
      primary: this.primaryColor(),
      secondary: this.secondaryColor(),
      background: this.base100(),
      grid: this.base300(),
      text: this.baseContent(),
      border: this.neutral(),
    };
  }

  public setTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    const preferences = this.localStorageService.getPreferences();
    this.localStorageService.savePreferences({
      ...preferences,
      selectedTheme: theme,
    });
    this.extractThemeColors();
  }

  public loadInitialTheme(): void {
    const preferences = this.localStorageService.getPreferences();
    document.documentElement.setAttribute(
      'data-theme',
      preferences.selectedTheme,
    );
    this.extractThemeColors();
  }

  public getTheme(): Theme {
    return this.localStorageService.getPreferences().selectedTheme;
  }
}

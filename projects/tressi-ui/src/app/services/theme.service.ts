import { computed, inject, Injectable, signal } from '@angular/core';

import { LocalStorageService } from './local-storage.service';

export const AllThemes = ['shine', 'storm'] as const;

export type Theme = (typeof AllThemes)[number];

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly _localStorageService = inject(LocalStorageService);

  readonly getTheme = computed(
    () => this._localStorageService.preferences().selectedTheme,
  );

  private readonly _primary = signal<string>('');
  readonly primary = computed(() => this._primary());

  private readonly _primaryContent = signal<string>('');
  readonly primaryContent = computed(() => this._primaryContent());

  private readonly _secondary = signal<string>('');
  readonly secondary = computed(() => this._secondary());

  private readonly _secondaryContent = signal<string>('');
  readonly secondaryContent = computed(() => this._secondaryContent());

  private readonly _accent = signal<string>('');
  readonly accent = computed(() => this._accent());

  private readonly _accentContent = signal<string>('');
  readonly accentContent = computed(() => this._accentContent());

  private readonly _base100 = signal<string>('');
  readonly base100 = computed(() => this._base100());

  private readonly _base200 = signal<string>('');
  readonly base200 = computed(() => this._base200());

  private readonly _base300 = signal<string>('');
  readonly base300 = computed(() => this._base300());

  private readonly _baseContent = signal<string>('');
  readonly baseContent = computed(() => this._baseContent());

  private readonly _neutral = signal<string>('');
  readonly neutral = computed(() => this._neutral());

  private readonly _neutralContent = signal<string>('');
  readonly neutralContent = computed(() => this._neutralContent());

  private readonly _info = signal<string>('');
  readonly info = computed(() => this._info());

  private readonly _infoContent = signal<string>('');
  readonly infoContent = computed(() => this._infoContent());

  private readonly _success = signal<string>('');
  readonly success = computed(() => this._success());

  private readonly _successContent = signal<string>('');
  readonly successContent = computed(() => this._successContent());

  private readonly _warning = signal<string>('');
  readonly warning = computed(() => this._warning());

  private readonly _warningContent = signal<string>('');
  readonly warningContent = computed(() => this._warningContent());

  private readonly _error = signal<string>('');
  readonly error = computed(() => this._error());

  private readonly _errorContent = signal<string>('');
  readonly errorContent = computed(() => this._errorContent());

  private readonly _radiusSelector = signal<string>('');
  readonly radiusSelector = computed(() => this._radiusSelector());

  private readonly _radiusField = signal<string>('');
  readonly radiusField = computed(() => this._radiusField());

  private readonly _radiusBox = signal<string>('');
  readonly radiusBox = computed(() => this._radiusBox());

  private readonly _sizeSelector = signal<string>('');
  readonly sizeSelector = computed(() => this._sizeSelector());

  private readonly _sizeField = signal<string>('');
  readonly sizeField = computed(() => this._sizeField());

  private readonly _border = signal<string>('');
  readonly border = computed(() => this._border());

  private readonly _depth = signal<string>('');
  readonly depth = computed(() => this._depth());

  private readonly _noise = signal<string>('');
  readonly noise = computed(() => this._noise());

  constructor() {
    this.loadInitialTheme();
    // Listen for theme changes (DaisyUI adds data-theme attribute)
    const observer = new MutationObserver(() => this._extractTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  private _extractTheme(): void {
    const computedStyle = getComputedStyle(document.documentElement);
    this._primary.set(
      computedStyle.getPropertyValue('--color-primary').trim() ||
        'oklch(81% 0.111 293.571)',
    );
    this._primaryContent.set(
      computedStyle.getPropertyValue('--color-primary-content').trim() ||
        'oklch(28% 0.141 291.089)',
    );
    this._secondary.set(
      computedStyle.getPropertyValue('--color-secondary').trim() ||
        'oklch(78% 0.115 274.713)',
    );
    this._secondaryContent.set(
      computedStyle.getPropertyValue('--color-secondary-content').trim() ||
        'oklch(25% 0.09 281.288)',
    );
    this._accent.set(
      computedStyle.getPropertyValue('--color-accent').trim() ||
        'oklch(78% 0.115 274.713)',
    );
    this._accentContent.set(
      computedStyle.getPropertyValue('--color-accent-content').trim() ||
        'oklch(25% 0.09 281.288)',
    );
    this._base100.set(
      computedStyle.getPropertyValue('--color-base-100').trim() ||
        'oklch(98% 0.001 106.423)',
    );
    this._base200.set(
      computedStyle.getPropertyValue('--color-base-200').trim() ||
        'oklch(97% 0.001 106.424)',
    );
    this._base300.set(
      computedStyle.getPropertyValue('--color-base-300').trim() ||
        'oklch(92% 0.003 48.717)',
    );
    this._baseContent.set(
      computedStyle.getPropertyValue('--color-base-content').trim() ||
        'oklch(21% 0.006 56.043)',
    );
    this._neutral.set(
      computedStyle.getPropertyValue('--color-neutral').trim() ||
        'oklch(14% 0.004 49.25)',
    );
    this._neutralContent.set(
      computedStyle.getPropertyValue('--color-neutral-content').trim() ||
        'oklch(98% 0.001 106.423)',
    );
    this._info.set(
      computedStyle.getPropertyValue('--color-info').trim() ||
        'oklch(68% 0.169 237.323)',
    );
    this._infoContent.set(
      computedStyle.getPropertyValue('--color-info-content').trim() ||
        'oklch(97% 0.013 236.62)',
    );
    this._success.set(
      computedStyle.getPropertyValue('--color-success').trim() ||
        'oklch(69% 0.17 162.48)',
    );
    this._successContent.set(
      computedStyle.getPropertyValue('--color-success-content').trim() ||
        'oklch(97% 0.021 166.113)',
    );
    this._warning.set(
      computedStyle.getPropertyValue('--color-warning').trim() ||
        'oklch(70% 0.213 47.604)',
    );
    this._warningContent.set(
      computedStyle.getPropertyValue('--color-warning-content').trim() ||
        'oklch(98% 0.016 73.684)',
    );
    this._error.set(
      computedStyle.getPropertyValue('--color-error').trim() ||
        'oklch(63% 0.237 25.331)',
    );
    this._errorContent.set(
      computedStyle.getPropertyValue('--color-error-content').trim() ||
        'oklch(97% 0.013 17.38)',
    );
    this._radiusSelector.set(
      computedStyle.getPropertyValue('--radius-selector').trim() || '2rem',
    );
    this._radiusField.set(
      computedStyle.getPropertyValue('--radius-field').trim() || '1rem',
    );
    this._radiusBox.set(
      computedStyle.getPropertyValue('--radius-box').trim() || '2rem',
    );
    this._sizeSelector.set(
      computedStyle.getPropertyValue('--size-selector').trim() || '0.25rem',
    );
    this._sizeField.set(
      computedStyle.getPropertyValue('--size-field').trim() || '0.25rem',
    );
    this._border.set(
      computedStyle.getPropertyValue('--border').trim() || '2px',
    );
    this._depth.set(computedStyle.getPropertyValue('--depth').trim() || '0');
    this._noise.set(computedStyle.getPropertyValue('--noise').trim() || '1');
  }

  // Get chart colors based on theme
  getChartColors(): {
    primary: string;
    secondary: string;
    background: string;
    grid: string;
    text: string;
    border: string;
  } {
    return {
      primary: this._primary(),
      secondary: this._secondary(),
      background: this._base200(),
      grid: this._base300(),
      text: this._baseContent(),
      border: this._neutral(),
    };
  }

  toggleTheme(): void {
    if (this.getTheme() === 'shine') {
      this.setTheme('storm');
    } else {
      this.setTheme('shine');
    }
  }

  setTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    const preferences = this._localStorageService.preferences();
    this._localStorageService.savePreferences({
      ...preferences,
      selectedTheme: theme,
    });
    this._extractTheme();
  }

  loadInitialTheme(): void {
    const preferences = this._localStorageService.preferences();
    document.documentElement.setAttribute(
      'data-theme',
      preferences.selectedTheme,
    );
    this._extractTheme();
  }
}

///////////////////////////
// * Daisy UI DefaultThemes
///////////////////////////
// export const AllThemes = [
//   'abyss',
//   'acid',
//   'aqua',
//   'autumn',
//   'black',
//   'bumblebee',
//   'business',
//   'caramellatte',
//   'cmyk',
//   'coffee',
//   'corporate',
//   'cupcake',
//   'cyberpunk',
//   'dark',
//   'dim',
//   'dracula',
//   'emerald',
//   'fantasy',
//   'forest',
//   'garden',
//   'halloween',
//   'lemonade',
//   'light',
//   'lofi',
//   'luxury',
//   'night',
//   'nord',
//   'pastel',
//   'retro',
//   'silk',
//   'sunset',
//   'synthwave',
//   'valentine',
//   'winter',
//   'wireframe',
// ] as const;

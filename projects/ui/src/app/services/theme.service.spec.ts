import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LocalStorageService } from './local-storage.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockLocalStorageService: {
    preferences: Mock;
    savePreferences: Mock;
  };

  beforeEach(() => {
    mockLocalStorageService = {
      preferences: vi.fn().mockReturnValue({ selectedTheme: 'shine' }),
      savePreferences: vi.fn(),
    };

    const styleProps: Record<string, string> = {
      '--border': '2px',
      '--color-accent': 'oklch(78% 0.115 274.713)',
      '--color-accent-content': 'oklch(25% 0.09 281.288)',
      '--color-base-100': 'oklch(98% 0.001 106.423)',
      '--color-base-200': 'oklch(97% 0.001 106.424)',
      '--color-base-300': 'oklch(92% 0.003 48.717)',
      '--color-base-content': 'oklch(21% 0.006 56.043)',
      '--color-error': 'oklch(63% 0.237 25.331)',
      '--color-error-content': 'oklch(97% 0.013 17.38)',
      '--color-info': 'oklch(68% 0.169 237.323)',
      '--color-info-content': 'oklch(97% 0.013 236.62)',
      '--color-neutral': 'oklch(14% 0.004 49.25)',
      '--color-neutral-content': 'oklch(98% 0.001 106.423)',
      '--color-primary': 'oklch(81% 0.111 293.571)',
      '--color-primary-content': 'oklch(28% 0.141 291.089)',
      '--color-secondary': 'oklch(78% 0.115 274.713)',
      '--color-secondary-content': 'oklch(25% 0.09 281.288)',
      '--color-success': 'oklch(69% 0.17 162.48)',
      '--color-success-content': 'oklch(97% 0.021 166.113)',
      '--color-warning': 'oklch(70% 0.213 47.604)',
      '--color-warning-content': 'oklch(98% 0.016 73.684)',
      '--depth': '0',
      '--noise': '1',
      '--radius-box': '2rem',
      '--radius-field': '1rem',
      '--radius-selector': '2rem',
      '--size-field': '0.25rem',
      '--size-selector': '0.25rem',
    };

    vi.spyOn(document.documentElement, 'style', 'get').mockReturnValue({
      getPropertyValue: vi.fn().mockImplementation((prop: string) => styleProps[prop] || ''),
    } as unknown as CSSStyleDeclaration);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: vi.fn().mockImplementation((prop: string) => styleProps[prop] || ''),
    } as unknown as CSSStyleDeclaration);

    class MockMutationObserver {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.spyOn(window, 'MutationObserver').mockImplementation(
      MockMutationObserver as unknown as new (
        callback: MutationCallback,
      ) => MutationObserver,
    );

    TestBed.configureTestingModule({
      providers: [{ provide: LocalStorageService, useValue: mockLocalStorageService }],
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isDark', () => {
    it('should return true when theme is storm', () => {
      mockLocalStorageService.preferences.mockReturnValue({ selectedTheme: 'storm' });
      service = TestBed.inject(ThemeService);
      expect(service.isDark()).toBe(true);
    });

    it('should return false when theme is shine', () => {
      mockLocalStorageService.preferences.mockReturnValue({ selectedTheme: 'shine' });
      service = TestBed.inject(ThemeService);
      expect(service.isDark()).toBe(false);
    });
  });

  describe('getTheme', () => {
    it('should return selected theme from preferences', () => {
      expect(service.getTheme()).toBe('shine');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from shine to storm', () => {
      service.toggleTheme();
      expect(mockLocalStorageService.savePreferences).toHaveBeenCalledWith({
        selectedTheme: 'storm',
      });
    });

    it('should toggle from storm to shine', () => {
      mockLocalStorageService.preferences.mockReturnValue({ selectedTheme: 'storm' });
      service = TestBed.inject(ThemeService);
      service.toggleTheme();
      expect(mockLocalStorageService.savePreferences).toHaveBeenCalledWith({
        selectedTheme: 'shine',
      });
    });
  });

  describe('setTheme', () => {
    it('should set data-theme attribute on document', () => {
      service.setTheme('storm');
      expect(document.documentElement.dataset['theme']).toBe('storm');
    });

    it('should save preferences with new theme', () => {
      service.setTheme('storm');
      expect(mockLocalStorageService.savePreferences).toHaveBeenCalledWith({
        selectedTheme: 'storm',
      });
    });
  });

  describe('loadInitialTheme', () => {
    it('should load theme from preferences and set on document', () => {
      mockLocalStorageService.preferences.mockReturnValue({ selectedTheme: 'storm' });
      service = TestBed.inject(ThemeService);
      service.loadInitialTheme();
      expect(document.documentElement.dataset['theme']).toBe('storm');
    });
  });

  describe('getChartColors', () => {
    it('should return chart colors based on current theme', () => {
      const colors = service.getChartColors();
      expect(colors).toEqual({
        background: 'oklch(97% 0.001 106.424)',
        border: 'oklch(14% 0.004 49.25)',
        grid: 'oklch(92% 0.003 48.717)',
        primary: 'oklch(81% 0.111 293.571)',
        secondary: 'oklch(78% 0.115 274.713)',
        text: 'oklch(21% 0.006 56.043)',
      });
    });
  });

  describe('theme color signals', () => {
    it('should expose primary color', () => {
      expect(service.primary()).toBe('oklch(81% 0.111 293.571)');
    });

    it('should expose base100 color', () => {
      expect(service.base100()).toBe('oklch(98% 0.001 106.423)');
    });

    it('should expose error color', () => {
      expect(service.error()).toBe('oklch(63% 0.237 25.331)');
    });

    it('should expose radiusSelector', () => {
      expect(service.radiusSelector()).toBe('2rem');
    });

    it('should expose border value', () => {
      expect(service.border()).toBe('2px');
    });
  });
});

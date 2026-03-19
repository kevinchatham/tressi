import { TestBed } from '@angular/core/testing';
import type { UserPreferences } from '@tressi/shared/ui';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LocalStorageService } from './local-storage.service';
import { LogService } from './log.service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  let mockLog: { error: Mock };

  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockLog = { error: vi.fn() };

    // Mock localStorage methods instead of stubbing the whole global
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockStorage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete mockStorage[key];
    });
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
      Object.keys(mockStorage).forEach((k) => void delete mockStorage[k]);
    });

    // Mock matchMedia for default preferences
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
      }),
    );

    TestBed.configureTestingModule({
      providers: [LocalStorageService, { provide: LogService, useValue: mockLog }],
    });

    service = TestBed.inject(LocalStorageService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.keys(mockStorage).forEach((k) => void delete mockStorage[k]);
  });

  it('should initialize with default preferences if storage is empty', () => {
    const prefs = service.preferences();
    expect(prefs.selectedTheme).toBe('shine'); // matches: false -> shine
    expect(prefs.pwaPromptDismissed).toBe(false);
  });

  it('should load preferences from localStorage', () => {
    const savedPrefs: UserPreferences = {
      columnPreferences: [],
      lastRoute: null,
      lastSelectedConfig: null,
      pwaPromptDismissed: true,
      selectedTheme: 'storm',
    } as unknown as UserPreferences;

    localStorage.setItem('tressi-user-preferences', JSON.stringify(savedPrefs));

    const newService = TestBed.runInInjectionContext(() => new LocalStorageService());

    expect(newService.preferences().selectedTheme).toBe('storm');
    expect(newService.preferences().pwaPromptDismissed).toBe(true);
  });

  it('should reset preferences if localStorage contains invalid data', () => {
    localStorage.setItem('tressi-user-preferences', 'invalid-json');

    const newService = TestBed.runInInjectionContext(() => new LocalStorageService());

    expect(mockLog.error).toHaveBeenCalled();
    expect(newService.preferences().selectedTheme).toBe('shine');
  });

  it('should save preferences to localStorage', () => {
    const newPrefs: UserPreferences = {
      ...service.preferences(),
      selectedTheme: 'storm',
    };

    service.savePreferences(newPrefs);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'tressi-user-preferences',
      expect.stringContaining('"selectedTheme":"storm"'),
    );
    expect(service.preferences().selectedTheme).toBe('storm');
  });

  it('should save last route', () => {
    service.saveLastRoute('/dashboard');

    expect(service.preferences().lastRoute).toBe('/dashboard');
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('should dismiss PWA prompt', () => {
    service.dismissPwaPrompt();

    expect(service.preferences().pwaPromptDismissed).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalled();
  });
});

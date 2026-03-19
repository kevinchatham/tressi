import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LocalStorageService } from './local-storage.service';
import { PwaService } from './pwa.service';

describe('PwaService', () => {
  let service: PwaService;
  let mockLocalStorage: { preferences: Mock; dismissPwaPrompt: Mock };
  let eventListeners: Record<string, (e: unknown) => void> = {};

  beforeEach(() => {
    eventListeners = {};

    // Use vi.spyOn instead of stubGlobal for window
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      eventListeners[event] = cb as (e: unknown) => void;
    });

    mockLocalStorage = {
      dismissPwaPrompt: vi.fn(),
      preferences: vi.fn().mockReturnValue({ pwaPromptDismissed: false }),
    };

    TestBed.configureTestingModule({
      providers: [PwaService, { provide: LocalStorageService, useValue: mockLocalStorage }],
    });

    service = TestBed.inject(PwaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize and listen for PWA events', () => {
    expect(window.addEventListener).toHaveBeenCalledWith(
      'beforeinstallprompt',
      expect.any(Function),
    );
    expect(window.addEventListener).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });

  describe('canInstall', () => {
    it('should return false initially', () => {
      expect(service.canInstall()).toBe(false);
    });

    it('should return true when beforeinstallprompt is fired and not dismissed', () => {
      const mockEvent = { preventDefault: vi.fn() };

      eventListeners['beforeinstallprompt'](mockEvent);

      expect(service.canInstall()).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should return false if prompt was dismissed in preferences', () => {
      mockLocalStorage.preferences.mockReturnValue({
        pwaPromptDismissed: true,
      });
      const mockEvent = { preventDefault: vi.fn() };

      eventListeners['beforeinstallprompt'](mockEvent);

      expect(service.canInstall()).toBe(false);
    });
  });

  describe('installPwa', () => {
    it('should trigger prompt and handle acceptance', async () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      eventListeners['beforeinstallprompt'](mockEvent);

      await service.installPwa();

      expect(mockEvent.prompt).toHaveBeenCalled();
      expect(service.canInstall()).toBe(false); // Cleared after acceptance
    });

    it('should trigger prompt and handle dismissal', async () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      };

      eventListeners['beforeinstallprompt'](mockEvent);

      await service.installPwa();

      expect(mockEvent.prompt).toHaveBeenCalled();
      expect(service.canInstall()).toBe(true); // Still available if dismissed
    });
  });

  describe('dismissPrompt', () => {
    it('should call localStorage to persist dismissal', () => {
      service.dismissPrompt();
      expect(mockLocalStorage.dismissPwaPrompt).toHaveBeenCalled();
    });
  });

  it('should clear prompt when app is installed', () => {
    const mockEvent = { preventDefault: vi.fn() };

    eventListeners['beforeinstallprompt'](mockEvent);
    expect(service.canInstall()).toBe(true);

    eventListeners['appinstalled']({});
    expect(service.canInstall()).toBe(false);
  });
});

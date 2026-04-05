import { computed, Injectable, inject, signal } from '@angular/core';

import { LocalStorageService } from './local-storage.service';

/**
 * Interface for the beforeinstallprompt event
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class PwaService {
  private readonly _localStorageService = inject(LocalStorageService);

  private readonly _deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);

  /**
   * Signal indicating if the PWA can be installed
   */
  canInstall = computed(() => {
    const promptDismissed = this._localStorageService.preferences().pwaPromptDismissed;
    return !!this._deferredPrompt() && !promptDismissed;
  });

  constructor() {
    globalThis.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini info bar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      this._deferredPrompt.set(e as BeforeInstallPromptEvent);
    });

    globalThis.addEventListener('appinstalled', () => {
      // Clear the deferredPrompt so it can be garbage collected
      this._deferredPrompt.set(null);
    });
  }

  /**
   * Triggers the native browser install prompt
   */
  async installPwa(): Promise<void> {
    const prompt = this._deferredPrompt();
    if (!prompt) return;

    prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === 'accepted') {
      this._deferredPrompt.set(null);
    }
  }

  /**
   * Dismisses the install prompt and persists the choice
   */
  dismissPrompt(): void {
    this._localStorageService.dismissPwaPrompt();
  }
}

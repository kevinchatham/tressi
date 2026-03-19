import type { Locator, Page } from '@playwright/test';

export type PageOptions = { timeout?: number };

export abstract class BasePage {
  protected readonly _page: Page;
  private readonly _loadingOverlay: Locator;

  constructor(page: Page) {
    this._page = page;
    this._loadingOverlay = page.locator('[data-e2e="loading-overlay"]');
  }

  protected async _waitForLoaded(locator: Locator, options?: PageOptions): Promise<void> {
    if (await this._loadingOverlay.isVisible()) {
      await this._loadingOverlay.waitFor({ state: 'hidden', ...options });
    }
    await locator.waitFor({ state: 'visible', ...options });
  }

  abstract waitForLoaded(options?: PageOptions): Promise<void>;
}

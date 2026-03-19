import type { Locator, Page } from '@playwright/test';

import { BasePage, type PageOptions } from './base.page';

export class DashboardPage extends BasePage {
  private readonly _startButton: Locator;
  private readonly _testRow: Locator;

  constructor(page: Page) {
    super(page);
    this._startButton = page.locator('[data-e2e="start-test-btn"]');
    this._testRow = page.locator('[data-e2e="test-row"]');
  }

  async goto(options?: PageOptions): Promise<void> {
    await this._page.goto('/dashboard', options);
    await this.waitForLoaded(options);
  }

  async waitForLoaded(options?: PageOptions): Promise<void> {
    await this._waitForLoaded(this._startButton, options);
  }

  async startTest(options?: PageOptions): Promise<void> {
    await this._startButton.click(options);
  }

  async viewLatestTest(options?: PageOptions): Promise<void> {
    // The test list table rows are clickable to view details
    const firstRow = this._testRow.first();
    await firstRow.waitFor({ state: 'visible', ...options });
    await firstRow.click(options);
  }
}

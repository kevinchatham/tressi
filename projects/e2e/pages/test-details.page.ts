import { expect, Locator, Page } from '@playwright/test';

import { BasePage, PageOptions } from './base.page';

export class TestDetailPage extends BasePage {
  private readonly _statusBadge: Locator;
  private readonly _performanceChart: Locator;

  constructor(page: Page) {
    super(page);
    this._statusBadge = page.locator('[data-e2e="status-badge"]');
    this._performanceChart = page.locator('[data-e2e="performance-chart"]');
  }

  async goto(testId: string, options?: PageOptions): Promise<void> {
    await this._page.goto(`/tests/${testId}`, options);
    await this.waitForLoaded(options);
  }

  async waitForLoaded(options?: PageOptions): Promise<void> {
    await this._waitForLoaded(this._statusBadge, options);
  }

  async verifyTestIsRunning(options?: PageOptions): Promise<void> {
    await expect(this._statusBadge).toBeVisible(options);
    await expect(this._performanceChart).toBeVisible(options);
  }

  async waitForCompletion(options?: PageOptions): Promise<void> {
    await expect(this._statusBadge).toContainText('Completed', options);
  }
}

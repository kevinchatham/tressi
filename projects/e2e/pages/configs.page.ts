import { Locator, Page } from '@playwright/test';

import { BasePage, PageOptions } from './base.page';

export class ConfigsPage extends BasePage {
  private readonly _header: Locator;
  private readonly _createButton: Locator;
  private readonly _nameInput: Locator;
  private readonly _durationInput: Locator;
  private readonly _endpointUrlInput: Locator;
  private readonly _saveButton: Locator;
  private readonly _requestsTab: Locator;
  private readonly _configCard: Locator;
  private readonly _configCardTitle: Locator;
  private readonly _useConfigButton: Locator;

  constructor(page: Page) {
    super(page);
    this._header = page.locator('[data-e2e="configs-header"]');
    this._createButton = page.locator('[data-e2e="create-config-btn"]');
    this._nameInput = page.locator('[data-e2e="config-name-input"]');
    this._durationInput = page.locator('[data-e2e="config-duration-input"]');
    this._endpointUrlInput = page.locator('[data-e2e="endpoint-url-input"]');
    this._saveButton = page.locator('[data-e2e="save-config-btn"]');
    this._requestsTab = page.locator('[data-e2e="requests-tab"]');
    this._configCard = page.locator('[data-e2e="config-card"]');
    this._configCardTitle = page.locator('[data-e2e="collapsible-card-title"]');
    this._useConfigButton = page.locator('[data-e2e="use-config-btn"]');
  }

  async goto(options?: PageOptions): Promise<void> {
    await this._page.goto('/configs', options);
    await this.waitForLoaded(options);
  }

  async waitForLoaded(options?: PageOptions): Promise<void> {
    await this._waitForLoaded(this._header, options);
  }

  async createConfig(
    name: string,
    duration: string,
    endpointUrl: string,
    options?: PageOptions,
  ): Promise<void> {
    await this._createButton.click(options);
    await this._nameInput.fill(name, options);
    await this._durationInput.fill(duration, options);

    // Switch to Requests tab
    await this._requestsTab.click(options);

    // Fill the first endpoint URL (it's already there by default)
    await this._endpointUrlInput.first().fill(endpointUrl, options);

    await this._saveButton.click(options);
  }

  async useConfig(name: string, options?: PageOptions): Promise<void> {
    const configCard = this._configCard.filter({
      hasText: name,
    });
    await configCard.waitFor({ state: 'visible', ...options });

    // Click the card header to expand it (the "Use" button is hidden when collapsed)
    await configCard.locator(this._configCardTitle).click(options);

    await configCard.locator(this._useConfigButton).click(options);
  }
}

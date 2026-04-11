import { Component, input } from '@angular/core';
import type { ConfigDocument } from '@tressi/shared/common';

import { ButtonComponent } from '../button/button.component';

@Component({
  imports: [ButtonComponent],
  selector: 'app-export-config-button',
  templateUrl: './export-config-button.component.html',
})
export class ExportConfigButtonComponent {
  /** Input configuration - required */
  config = input.required<ConfigDocument>();

  /**
   * Exports the configuration as a JSON file
   */
  async export(): Promise<void> {
    try {
      // Create a JSON blob from the configuration data only
      const { config, epochUpdatedAt, epochCreatedAt, name } = this.config();
      const jsonString = JSON.stringify(config, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Create a download link with updatedAt timestamp in filename
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = epochUpdatedAt || epochCreatedAt || Date.now();
      link.download = `tressi-${this.toSlug(name)}-${timestamp}.json`;

      // Trigger the download
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Clean up the URL
      URL.revokeObjectURL(url);
    } catch {}
  }

  toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replaceAll(/[^\w\s-]/g, '') // remove special characters
      .replaceAll(/[\s_-]+/g, '-') // replace spaces and underscores with hyphens
      .replaceAll(/^(-+|-+)$/g, ''); // remove leading/trailing hyphens
  }
}

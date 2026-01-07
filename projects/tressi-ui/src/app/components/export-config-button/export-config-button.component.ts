import { Component, input } from '@angular/core';

import { ConfigDocument } from '../../services/rpc.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-export-config-button',
  standalone: true,
  imports: [IconComponent],
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
      document.body.removeChild(link);

      // Clean up the URL
      URL.revokeObjectURL(url);
    } catch {}
  }

  toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove special characters
      .replace(/[\s_-]+/g, '-') // replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // remove leading/trailing hyphens
  }
}

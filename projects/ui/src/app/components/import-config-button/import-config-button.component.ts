import { Component, inject, output } from '@angular/core';
import { type SaveConfigRequest, validateConfig } from '@tressi/shared/common';

import { NameService } from '../../services/name.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  imports: [ButtonComponent],
  selector: 'app-import-config-button',
  templateUrl: './import-config-button.component.html',
})
export class ImportConfigButtonComponent {
  private readonly _nameService = inject(NameService);

  /** Output event when a valid config is imported */
  readonly configImported = output<SaveConfigRequest>();

  /** Output event for import errors */
  readonly importError = output<string>();

  /**
   * Handles file selection from input element
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Validate against TressiConfig schema
      const validation = validateConfig(parsed);

      if (!validation.success) {
        this.importError.emit(`Invalid configuration file`);
        return;
      }

      // Convert TressiConfig to ModifyConfigRequest
      const importedConfig: SaveConfigRequest = {
        config: validation.data,
        name: this._generateNameFromFile(file.name),
      };

      this.configImported.emit(importedConfig);
    } catch (error) {
      this.importError.emit(
        error instanceof SyntaxError
          ? 'Invalid JSON file format'
          : 'Failed to read configuration file',
      );
    } finally {
      // Reset input to allow selecting the same file again
      input.value = '';
    }
  }

  private _generateNameFromFile(fileName: string): string {
    const cleanedName = fileName
      .replace(/\.(json)$/i, '')
      .replace(/^(tressi|config)[-_]/i, '')
      .replace(/[-_](\d+|[a-f0-9]{8,})$/i, '')
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .replaceAll(/ {2,}/g, ' ')
      .trim();

    // If the cleaned name is empty, generate a unique name
    if (cleanedName.length === 0) {
      return this._nameService.generate();
    }

    // Convert to title case (capitalize first letter of each word)
    return cleanedName.replaceAll(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Triggers the hidden file input click
   */
  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }
}

import { Component, inject, output } from '@angular/core';
import { validateConfig } from '@tressi-cli/common/config';

import { NameService } from '../../services/name.service';
import { ModifyConfigRequest } from '../../services/rpc.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-import-config-button',
  imports: [ButtonComponent],
  templateUrl: './import-config-button.component.html',
})
export class ImportConfigButtonComponent {
  private readonly _nameService = inject(NameService);

  /** Output event when a valid config is imported */
  readonly configImported = output<ModifyConfigRequest>();

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
        this.importError.emit('Invalid configuration file format');
        return;
      }

      // Convert TressiConfig to ModifyConfigRequest
      const importedConfig: ModifyConfigRequest = {
        name: this._generateNameFromFile(file.name),
        config: validation.data,
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
      .replace(/\.(json)$/i, '') // Support json only
      .replace(/^(tressi|config)[-_]/i, '') // Remove common prefixes with dash or underscore
      .replace(/[-_](\d+|[a-f0-9]{8,})$/i, '') // Remove trailing IDs (numbers or hex hashes)
      .replace(/[-_]+/g, ' ') // Replace multiple dashes/underscores with single space
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();

    // If the cleaned name is empty, generate a unique name
    if (cleanedName.length === 0) {
      return this._nameService.generate();
    }

    // Convert to title case (capitalize first letter of each word)
    return cleanedName.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Triggers the hidden file input click
   */
  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }
}

import { Component, input, output, signal } from '@angular/core';
import { Field } from '@angular/forms/signals';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { CollapsibleCardComponent } from '../../collapsible-card/collapsible-card.component';
import { IconComponent } from '../../icon/icon.component';
import { JsonTextareaComponent } from '../../json-textarea/json-textarea.component';
import { ModifyConfigRequestFormType } from '../config-form.component';
import { EarlyExitConfigComponent } from '../early-exit-config/early-exit-config.component';

@Component({
  selector: 'app-general-config',
  imports: [
    Field,
    IconComponent,
    EarlyExitConfigComponent,
    JsonTextareaComponent,
    CollapsibleCardComponent,
  ],
  templateUrl: './general-config.component.html',
})
export class GeneralConfigComponent {
  /** Form instance from parent */
  readonly form = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly model = input.required<ModifyConfigRequest>();

  /** Event to add an exit status code */
  readonly addExitStatusCode = output<void>();

  /** Event to remove an exit status code */
  readonly removeExitStatusCode = output<number>();

  /** Event emitted when JSON textarea value changes */
  readonly jsonTextareaChange = output<void>();

  /** Collapsed state for engine settings */
  readonly engineSettingsCollapsed = signal(true);

  /** Collapsed state for global defaults */
  readonly globalDefaultsCollapsed = signal(true);

  /** Handle JSON textarea value changes */
  onJsonTextareaValueChange(): void {
    this.jsonTextareaChange.emit();
  }
}

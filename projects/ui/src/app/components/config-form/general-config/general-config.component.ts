import { Component, inject, input, signal } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { SaveConfigRequest } from '@tressi/shared/common';
import type { ModifyConfigRequestFormType } from '@tressi/shared/ui';
import { PreventNumberScrollDirective } from '../../../directives/prevent-number-scroll.directive';
import { CollapsibleCardComponent } from '../../collapsible-card/collapsible-card.component';
import { IconComponent } from '../../icon/icon.component';
import { JsonTextareaComponent } from '../../json-textarea/json-textarea.component';
import { ConfigFormService } from '../config-form.service';
import { EarlyExitConfigComponent } from '../early-exit-config/early-exit-config.component';

@Component({
  imports: [
    IconComponent,
    EarlyExitConfigComponent,
    JsonTextareaComponent,
    CollapsibleCardComponent,
    FormField,
    PreventNumberScrollDirective,
  ],
  selector: 'app-general-config',
  templateUrl: './general-config.component.html',
})
export class GeneralConfigComponent {
  private readonly _service = inject(ConfigFormService);

  readonly form = input.required<ModifyConfigRequestFormType>();

  readonly model = input.required<SaveConfigRequest>();

  readonly engineSettingsCollapsed = signal(true);

  readonly globalDefaultsCollapsed = signal(true);

  onJsonTextareaValueChange(): void {
    this._service.onJsonTextAreaChange();
  }

  addExitStatusCode(): void {
    this._service.addGlobalExitStatusCode();
  }

  removeExitStatusCode(index: number): void {
    this._service.removeGlobalExitStatusCode(index);
  }
}

import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output } from '@angular/core';
import type { ConfigDocument, SaveConfigRequest } from '@tressi/shared/common';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { ConfigFormService } from './config-form.service';
import { GeneralConfigComponent } from './general-config/general-config.component';
import { RequestsConfigComponent } from './requests-config/requests-config.component';

@Component({
  imports: [
    CommonModule,
    IconComponent,
    GeneralConfigComponent,
    RequestsConfigComponent,
    ButtonComponent,
  ],
  providers: [ConfigFormService],
  selector: 'app-config-form',
  templateUrl: './config-form.component.html',
})
export class ConfigFormComponent {
  protected readonly _service = inject(ConfigFormService);

  readonly input = input<ConfigDocument | null>(null);

  readonly output = output<SaveConfigRequest>();

  readonly closed = output<void>();

  readonly model = this._service.model;
  readonly form = this._service.form;
  readonly isFormValid = this._service.isFormValid;
  readonly activeTab = this._service.activeTab;

  constructor() {
    effect(() => {
      const input = this.input();
      if (input !== null) {
        this._service.loadConfig(input);
      } else {
        this._service.loadConfig(null);
      }
    });
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.output.emit(this._service.submit());
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this._service.reset();
    this.closed.emit();
  }

  setActiveTab(tab: 'general' | 'requests'): void {
    this._service.setActiveTab(tab);
  }
}

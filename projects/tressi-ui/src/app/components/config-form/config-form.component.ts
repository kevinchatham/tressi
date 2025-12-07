import { Component, signal } from '@angular/core';
import { Field, form, required } from '@angular/forms/signals';
import { defaultTressiConfig, TressiConfig } from 'tressi-common/config';

@Component({
  selector: 'app-config-form',
  imports: [Field],
  templateUrl: './config-form.component.html',
})
export class ConfigFormComponent {
  configModel = signal<TressiConfig>(defaultTressiConfig);

  configForm = form(this.configModel, (schemaPath) => {
    required(schemaPath.options.durationSec, {
      message: 'Duration is required',
    });
  });

  onSubmit(event: Event): void {
    event.preventDefault();
    const config = this.configModel();
    console.log('New config:', config);
  }
}

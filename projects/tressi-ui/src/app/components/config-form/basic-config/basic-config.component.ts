import { Component, input } from '@angular/core';
import { Field } from '@angular/forms/signals';
import { TressiConfig } from 'tressi-common/config';

import { IconComponent } from '../../icon/icon.component';
import { TressiConfigForm } from '../config-form.component';

@Component({
  selector: 'app-basic-config',
  imports: [Field, IconComponent],
  templateUrl: './basic-config.component.html',
})
export class BasicConfigComponent {
  /** Form instance from parent */
  readonly configForm = input.required<TressiConfigForm>();

  /** Config model from parent */
  readonly configModel = input.required<TressiConfig>();
}

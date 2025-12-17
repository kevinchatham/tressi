import { Component, input } from '@angular/core';
import { Field } from '@angular/forms/signals';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { IconComponent } from '../../icon/icon.component';
import { ModifyConfigRequestFormType } from '../config-form.component';

@Component({
  selector: 'app-advanced-config',
  imports: [Field, IconComponent],
  templateUrl: './advanced-config.component.html',
})
export class AdvancedConfigComponent {
  /** Form instance from parent */
  readonly form = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly model = input.required<ModifyConfigRequest>();
}

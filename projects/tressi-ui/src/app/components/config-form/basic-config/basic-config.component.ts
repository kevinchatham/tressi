import { Component, input } from '@angular/core';
import { Field } from '@angular/forms/signals';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { IconComponent } from '../../icon/icon.component';
import { ModifyConfigRequestFormType } from '../config-form.component';

@Component({
  selector: 'app-basic-config',
  imports: [Field, IconComponent],
  templateUrl: './basic-config.component.html',
})
export class BasicConfigComponent {
  /** Form instance from parent */
  readonly configForm = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly configModel = input.required<ModifyConfigRequest>();
}

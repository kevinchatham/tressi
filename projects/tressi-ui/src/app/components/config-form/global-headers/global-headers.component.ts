import { Component, input } from '@angular/core';

import { ModifyConfigRequest } from '../../../services/rpc.service';
import { IconComponent } from '../../icon/icon.component';
import { ModifyConfigRequestFormType } from '../config-form.component';

@Component({
  selector: 'app-global-headers',
  imports: [IconComponent],
  templateUrl: './global-headers.component.html',
})
export class GlobalHeadersComponent {
  /** Form instance from parent */
  readonly configForm = input.required<ModifyConfigRequestFormType>();

  /** Config model from parent */
  readonly configModel = input.required<ModifyConfigRequest>();
}

import { Component, input, output } from '@angular/core';
import { Field } from '@angular/forms/signals';
import { TressiConfig } from 'tressi-common/config';

import { IconComponent } from '../../icon/icon.component';
import { TressiConfigForm } from '../config-form.component';

@Component({
  selector: 'app-worker-early-exit',
  imports: [Field, IconComponent],
  templateUrl: './worker-early-exit.component.html',
})
export class WorkerEarlyExitComponent {
  /** Form instance from parent */
  readonly configForm = input.required<TressiConfigForm>();

  /** Config model from parent */
  readonly configModel = input.required<TressiConfig>();

  /** Event to add a new per-endpoint threshold */
  readonly addPerEndpointThreshold = output<void>();

  /** Event to remove a per-endpoint threshold */
  readonly removePerEndpointThreshold = output<number>();

  /** Event to add a worker exit status code */
  readonly addWorkerExitStatusCode = output<void>();

  /** Event to remove a worker exit status code */
  readonly removeWorkerExitStatusCode = output<number>();
}

import {
  type AfterViewInit,
  Component,
  type ElementRef,
  inject,
  input,
  type OnChanges,
  type SimpleChanges,
  signal,
  viewChildren,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { httpMethodDefaults, type SaveConfigRequest } from '@tressi/shared/common';
import type { ModifyConfigRequestFormType } from '@tressi/shared/ui';
import { PreventNumberScrollDirective } from '../../../directives/prevent-number-scroll.directive';
import { ButtonComponent } from '../../button/button.component';
import { CollapsibleCardComponent } from '../../collapsible-card/collapsible-card.component';
import { IconComponent } from '../../icon/icon.component';
import { JsonTextareaComponent } from '../../json-textarea/json-textarea.component';
import { ConfigFormService } from '../config-form.service';
import { EarlyExitConfigComponent } from '../early-exit-config/early-exit-config.component';

@Component({
  imports: [
    IconComponent,
    JsonTextareaComponent,
    EarlyExitConfigComponent,
    ButtonComponent,
    CollapsibleCardComponent,
    FormField,
    PreventNumberScrollDirective,
  ],
  selector: 'app-requests-config',
  templateUrl: './requests-config.component.html',
})
export class RequestsConfigComponent implements AfterViewInit, OnChanges {
  private readonly _service = inject(ConfigFormService);

  readonly form = input.required<ModifyConfigRequestFormType>();

  readonly model = input.required<SaveConfigRequest>();

  expandedRequests = new Set<number>();

  private readonly _requestCount = signal(0);

  private readonly _urlInputs = viewChildren<ElementRef<HTMLInputElement>>('urlInput');

  ngAfterViewInit(): void {
    this._focusLastUrlInput();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    const currentCount = this.model().config.requests?.length || 0;
    const previousCount = this._requestCount();

    if (currentCount > previousCount) {
      for (let i = 0; i < currentCount - 1; i++) {
        this.expandedRequests.add(i);
      }

      this.expandedRequests.delete(currentCount - 1);

      this._requestCount.set(currentCount);

      setTimeout(() => this._focusLastUrlInput(), 0);
    } else if (currentCount < previousCount) {
      this._requestCount.set(currentCount);
    }
  }

  onUrlInputChange(): void {
    this._requestCount.set(this.model().config.requests?.length || 0);
  }

  toggleRequest(index: number): void {
    if (this.expandedRequests.has(index)) {
      this.expandedRequests.delete(index);
    } else {
      this.expandedRequests.add(index);
    }
  }

  isRequestExpanded(index: number): boolean {
    const currentRequestCount = this.model().config.requests?.length || 0;

    if (index === currentRequestCount - 1 && this.expandedRequests.has(index) === false) {
      return true;
    }

    return !this.expandedRequests.has(index);
  }

  onJsonTextareaValueChange(): void {
    this._service.onJsonTextAreaChange();
  }

  addRequest(): void {
    this._service.addRequest();
  }

  removeRequest(index: number): void {
    this._service.removeRequest(index);
  }

  addRequestExitStatusCode(requestIndex: number): void {
    this._service.addRequestExitStatusCode(requestIndex);
  }

  removeRequestExitStatusCode(requestIndex: number, codeIndex: number): void {
    this._service.removeRequestExitStatusCode(requestIndex, codeIndex);
  }

  readonly httpMethods = httpMethodDefaults;

  supportsRequestBody(method: string): boolean {
    const bodyMethods = ['POST', 'PUT', 'PATCH'];
    return bodyMethods.includes(method.toUpperCase());
  }

  private _focusLastUrlInput(): void {
    const inputs = this._urlInputs();
    if (inputs && inputs.length > 0) {
      const lastInput = inputs[inputs.length - 1];
      lastInput.nativeElement.focus();
    }
  }
}

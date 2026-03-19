import { runInInjectionContext, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { defaultTressiConfig, type SaveConfigRequest } from '@tressi/shared/common';
import type { ModifyConfigRequestFormType } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestsConfigComponent } from './requests-config.component';

describe('RequestsConfigComponent', () => {
  let component: RequestsConfigComponent;
  let fixture: ComponentFixture<RequestsConfigComponent>;
  let mockForm: ModifyConfigRequestFormType;
  let modelSignal: WritableSignal<SaveConfigRequest>;

  const mockModel: SaveConfigRequest = {
    config: {
      ...defaultTressiConfig,
      requests: [
        {
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0.5,
            exitStatusCodes: [],
            monitoringWindowMs: 1000,
          },
          headers: {},
          method: 'GET',
          payload: {},
          rampUpDurationSec: 0,
          rps: 10,
          url: 'http://example.com',
        },
      ],
    },
    name: 'Test Config',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestsConfigComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsConfigComponent);
    component = fixture.componentInstance;

    modelSignal = signal(mockModel);
    runInInjectionContext(fixture.debugElement.injector, () => {
      mockForm = form(modelSignal);
    });

    fixture.componentRef.setInput('form', mockForm);
    fixture.componentRef.setInput('model', mockModel);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle request expansion', () => {
    // Initially expanded (index 0 is the only request)
    expect(component.isRequestExpanded(0)).toBe(true);

    component.toggleRequest(0);
    expect(component.isRequestExpanded(0)).toBe(false);

    component.toggleRequest(0);
    expect(component.isRequestExpanded(0)).toBe(true);
  });

  it('should handle new request addition in ngOnChanges', async () => {
    const newModel: SaveConfigRequest = {
      ...mockModel,
      config: {
        ...mockModel.config,
        requests: [
          ...mockModel.config.requests!,
          {
            earlyExit: {
              enabled: false,
              errorRateThreshold: 0.5,
              exitStatusCodes: [],
              monitoringWindowMs: 1000,
            },
            headers: {},
            method: 'POST',
            payload: {},
            rampUpDurationSec: 0,
            rps: 5,
            url: 'http://example2.com',
          },
        ],
      },
    };

    modelSignal.set(newModel);
    fixture.componentRef.setInput('model', newModel);
    fixture.detectChanges();
    component.ngOnChanges();

    // Wait for setTimeout(..., 0) in ngOnChanges
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The new request (index 1) should be expanded
    expect(component.isRequestExpanded(1)).toBe(true);
    // The old request (index 0) should be collapsed by ngOnChanges logic
    expect(component.isRequestExpanded(0)).toBe(false);
  });

  it('should identify methods that support request body', () => {
    expect(component.supportsRequestBody('POST')).toBe(true);
    expect(component.supportsRequestBody('PUT')).toBe(true);
    expect(component.supportsRequestBody('PATCH')).toBe(true);
    expect(component.supportsRequestBody('GET')).toBe(false);
    expect(component.supportsRequestBody('DELETE')).toBe(false);
  });

  it('should emit events correctly', () => {
    const addRequestSpy = vi.spyOn(component.addRequest, 'emit');
    component.addRequest.emit();
    expect(addRequestSpy).toHaveBeenCalled();

    const removeRequestSpy = vi.spyOn(component.removeRequest, 'emit');
    component.removeRequest.emit(0);
    expect(removeRequestSpy).toHaveBeenCalledWith(0);

    const jsonChangeSpy = vi.spyOn(component.jsonTextareaChange, 'emit');
    component.onJsonTextareaValueChange();
    expect(jsonChangeSpy).toHaveBeenCalled();
  });

  it('should emit early exit events', () => {
    const addExitSpy = vi.spyOn(component.addRequestExitStatusCode, 'emit');
    component.addRequestExitStatusCode.emit(0);
    expect(addExitSpy).toHaveBeenCalledWith(0);

    const removeExitSpy = vi.spyOn(component.removeRequestExitStatusCode, 'emit');
    component.removeRequestExitStatusCode.emit({
      codeIndex: 1,
      requestIndex: 0,
    });
    expect(removeExitSpy).toHaveBeenCalledWith({
      codeIndex: 1,
      requestIndex: 0,
    });
  });
});

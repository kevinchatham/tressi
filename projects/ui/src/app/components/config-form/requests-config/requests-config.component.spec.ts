import { runInInjectionContext, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { defaultTressiConfig, type SaveConfigRequest } from '@tressi/shared/common';
import type { ModifyConfigRequestFormType } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigFormService } from '../config-form.service';
import { RequestsConfigComponent } from './requests-config.component';

describe('RequestsConfigComponent', () => {
  let component: RequestsConfigComponent;
  let fixture: ComponentFixture<RequestsConfigComponent>;
  let mockForm: ModifyConfigRequestFormType;
  let modelSignal: WritableSignal<SaveConfigRequest>;
  let mockService: {
    onJsonTextAreaChange: ReturnType<typeof vi.fn>;
    addRequest: ReturnType<typeof vi.fn>;
    removeRequest: ReturnType<typeof vi.fn>;
    addRequestExitStatusCode: ReturnType<typeof vi.fn>;
    removeRequestExitStatusCode: ReturnType<typeof vi.fn>;
  };

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
    mockService = {
      addRequest: vi.fn(),
      addRequestExitStatusCode: vi.fn(),
      onJsonTextAreaChange: vi.fn(),
      removeRequest: vi.fn(),
      removeRequestExitStatusCode: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RequestsConfigComponent],
      providers: [{ provide: ConfigFormService, useValue: mockService }],
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
    expect(component.isRequestExpanded(0)).toBe(true);

    component.toggleRequest(0);
    expect(component.isRequestExpanded(0)).toBe(false);

    component.toggleRequest(0);
    expect(component.isRequestExpanded(0)).toBe(true);
  });

  it('should identify methods that support request body', () => {
    expect(component.supportsRequestBody('POST')).toBe(true);
    expect(component.supportsRequestBody('PUT')).toBe(true);
    expect(component.supportsRequestBody('PATCH')).toBe(true);
    expect(component.supportsRequestBody('GET')).toBe(false);
    expect(component.supportsRequestBody('DELETE')).toBe(false);
  });

  it('should call service methods for add/remove request', () => {
    component.addRequest();
    expect(mockService.addRequest).toHaveBeenCalled();

    component.removeRequest(0);
    expect(mockService.removeRequest).toHaveBeenCalledWith(0);
  });

  it('should call service methods for early exit status codes', () => {
    component.addRequestExitStatusCode(0);
    expect(mockService.addRequestExitStatusCode).toHaveBeenCalledWith(0);

    component.removeRequestExitStatusCode(0, 1);
    expect(mockService.removeRequestExitStatusCode).toHaveBeenCalledWith(0, 1);
  });

  it('should call onJsonTextareaValueChange on the service', () => {
    component.onJsonTextareaValueChange();
    expect(mockService.onJsonTextAreaChange).toHaveBeenCalled();
  });
});

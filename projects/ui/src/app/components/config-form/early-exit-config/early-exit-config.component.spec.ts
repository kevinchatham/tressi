import { runInInjectionContext, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import type { TressiEarlyExitConfig } from '@tressi/shared/common';
import type { EarlyExitConfigRequestFormType } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigFormService } from '../config-form.service';
import { EarlyExitConfigComponent } from './early-exit-config.component';

describe('EarlyExitConfigComponent', () => {
  let component: EarlyExitConfigComponent;
  let fixture: ComponentFixture<EarlyExitConfigComponent>;
  let mockForm: EarlyExitConfigRequestFormType;
  let mockService: {
    addGlobalExitStatusCode: ReturnType<typeof vi.fn>;
    removeGlobalExitStatusCode: ReturnType<typeof vi.fn>;
    addRequestExitStatusCode: ReturnType<typeof vi.fn>;
    removeRequestExitStatusCode: ReturnType<typeof vi.fn>;
  };

  const mockModel: TressiEarlyExitConfig = {
    enabled: true,
    errorRateThreshold: 0.5,
    exitStatusCodes: [500, 502],
    monitoringWindowSeconds: 1,
  };

  beforeEach(async () => {
    mockService = {
      addGlobalExitStatusCode: vi.fn(),
      addRequestExitStatusCode: vi.fn(),
      removeGlobalExitStatusCode: vi.fn(),
      removeRequestExitStatusCode: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [EarlyExitConfigComponent],
      providers: [{ provide: ConfigFormService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(EarlyExitConfigComponent);
    component = fixture.componentInstance;

    runInInjectionContext(fixture.debugElement.injector, () => {
      mockForm = form(signal(mockModel));
    });

    fixture.componentRef.setInput('form', mockForm);
    fixture.componentRef.setInput('model', mockModel);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return isEnabled correctly', () => {
    expect(component.isEnabled()).toBe(true);

    fixture.componentRef.setInput('model', { ...mockModel, enabled: false });
    expect(component.isEnabled()).toBe(false);
  });

  it('should return exit status codes', () => {
    expect(component.getExitStatusCodes()).toEqual([500, 502]);
  });

  it('should call addExitStatusCode when addExitStatusCode() is called (global mode)', () => {
    component.addExitStatusCode();
    expect(mockService.addGlobalExitStatusCode).toHaveBeenCalled();
  });

  it('should call removeExitStatusCode when removeExitStatusCode() is called (global mode)', () => {
    component.removeExitStatusCode(1);
    expect(mockService.removeGlobalExitStatusCode).toHaveBeenCalledWith(1);
  });

  it('should call addRequestExitStatusCode when addExitStatusCode() is called with requestIndex', () => {
    fixture.componentRef.setInput('requestIndex', 0);
    component.addExitStatusCode();
    expect(mockService.addRequestExitStatusCode).toHaveBeenCalledWith(0);
  });

  it('should call removeRequestExitStatusCode when removeExitStatusCode() is called with requestIndex', () => {
    fixture.componentRef.setInput('requestIndex', 0);
    component.removeExitStatusCode(1);
    expect(mockService.removeRequestExitStatusCode).toHaveBeenCalledWith(0, 1);
  });
});

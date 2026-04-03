import { runInInjectionContext, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { defaultTressiConfig, type SaveConfigRequest } from '@tressi/shared/common';
import type { ModifyConfigRequestFormType } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigFormService } from '../config-form.service';
import { GeneralConfigComponent } from './general-config.component';

describe('GeneralConfigComponent', () => {
  let component: GeneralConfigComponent;
  let fixture: ComponentFixture<GeneralConfigComponent>;
  let mockForm: ModifyConfigRequestFormType;
  let mockService: {
    onJsonTextAreaChange: ReturnType<typeof vi.fn>;
    addGlobalExitStatusCode: ReturnType<typeof vi.fn>;
    removeGlobalExitStatusCode: ReturnType<typeof vi.fn>;
  };

  const mockModel: SaveConfigRequest = {
    config: defaultTressiConfig,
    name: 'Test Config',
  };

  beforeEach(async () => {
    mockService = {
      addGlobalExitStatusCode: vi.fn(),
      onJsonTextAreaChange: vi.fn(),
      removeGlobalExitStatusCode: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [GeneralConfigComponent],
      providers: [{ provide: ConfigFormService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(GeneralConfigComponent);
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

  it('should have default collapsed states', () => {
    expect(component.engineSettingsCollapsed()).toBe(true);
    expect(component.globalDefaultsCollapsed()).toBe(true);
  });

  it('should call onJsonTextareaValueChange on the service', () => {
    component.onJsonTextareaValueChange();
    expect(mockService.onJsonTextAreaChange).toHaveBeenCalled();
  });

  it('should call addExitStatusCode on the service', () => {
    component.addExitStatusCode();
    expect(mockService.addGlobalExitStatusCode).toHaveBeenCalled();
  });

  it('should call removeExitStatusCode on the service', () => {
    component.removeExitStatusCode(1);
    expect(mockService.removeGlobalExitStatusCode).toHaveBeenCalledWith(1);
  });
});

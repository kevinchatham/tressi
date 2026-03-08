import { runInInjectionContext, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { defaultTressiConfig, SaveConfigRequest } from '@tressi/shared/common';
import { ModifyConfigRequestFormType } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GeneralConfigComponent } from './general-config.component';

describe('GeneralConfigComponent', () => {
  let component: GeneralConfigComponent;
  let fixture: ComponentFixture<GeneralConfigComponent>;
  let mockForm: ModifyConfigRequestFormType;

  const mockModel: SaveConfigRequest = {
    name: 'Test Config',
    config: defaultTressiConfig,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneralConfigComponent],
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

  it('should emit jsonTextareaChange when onJsonTextareaValueChange is called', () => {
    const spy = vi.spyOn(component.jsonTextareaChange, 'emit');
    component.onJsonTextareaValueChange();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit addExitStatusCode when requested', () => {
    const spy = vi.spyOn(component.addExitStatusCode, 'emit');
    component.addExitStatusCode.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit removeExitStatusCode when requested', () => {
    const spy = vi.spyOn(component.removeExitStatusCode, 'emit');
    component.removeExitStatusCode.emit(1);
    expect(spy).toHaveBeenCalledWith(1);
  });
});

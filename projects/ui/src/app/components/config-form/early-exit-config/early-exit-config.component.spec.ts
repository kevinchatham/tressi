import { runInInjectionContext, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { TressiEarlyExitConfig } from '@tressi/shared/common';
import { EarlyExitConfigRequestFormType } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EarlyExitConfigComponent } from './early-exit-config.component';

describe('EarlyExitConfigComponent', () => {
  let component: EarlyExitConfigComponent;
  let fixture: ComponentFixture<EarlyExitConfigComponent>;
  let mockForm: EarlyExitConfigRequestFormType;

  const mockModel: TressiEarlyExitConfig = {
    enabled: true,
    errorRateThreshold: 0.5,
    exitStatusCodes: [500, 502],
    monitoringWindowMs: 1000,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EarlyExitConfigComponent],
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

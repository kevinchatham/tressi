import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type ConfigDocument, defaultTressiConfig } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NameService } from '../../services/name.service';
import { ConfigFormComponent } from './config-form.component';

describe('ConfigFormComponent', () => {
  let component: ConfigFormComponent;
  let fixture: ComponentFixture<ConfigFormComponent>;
  let mockNameService: {
    generate: ReturnType<typeof vi.fn>;
  };

  const mockConfig: ConfigDocument = {
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
    epochCreatedAt: 123,
    epochUpdatedAt: 123,
    id: 'test-id',
    name: 'Test Config',
  };

  beforeEach(async () => {
    mockNameService = {
      generate: vi.fn().mockReturnValue('Random Name'),
    };

    await TestBed.configureTestingModule({
      imports: [ConfigFormComponent],
      providers: [{ provide: NameService, useValue: mockNameService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty config if no input is provided', () => {
    expect(component.model().name).toBe('Random Name');
    expect(component.model().config.requests?.length).toBe(1);
  });

  it('should initialize with input config if provided', () => {
    fixture.componentRef.setInput('input', mockConfig);
    fixture.detectChanges();
    expect(component.model().name).toBe('Test Config');
    expect(component.model().id).toBe('test-id');
  });

  it('should toggle active tab via service', () => {
    expect(component.activeTab()).toBe('general');
    component.setActiveTab('requests');
    expect(component.activeTab()).toBe('requests');
  });

  it('should emit output on submit', () => {
    const spy = vi.spyOn(component.output, 'emit');
    const event = new Event('submit');
    component.onSubmit(event);
    expect(spy).toHaveBeenCalledWith(component.model());
  });

  it('should emit closed and reset on cancel', () => {
    const spy = vi.spyOn(component.closed, 'emit');
    const event = new Event('click');
    component.onCancel(event);
    expect(spy).toHaveBeenCalled();
    expect(component.model().name).toBe('Random Name');
  });
});

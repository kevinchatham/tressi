import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  type ConfigDocument,
  defaultTressiConfig,
  type TressiRequestConfig,
} from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeService } from '../../services/time.service';
import { ConfigCardComponent } from './config-card.component';

describe('ConfigCardComponent', () => {
  let component: ConfigCardComponent;
  let fixture: ComponentFixture<ConfigCardComponent>;
  let mockTimeService: {
    getRelativeTimeString: ReturnType<typeof vi.fn>;
  };

  const mockConfig: ConfigDocument = {
    config: {
      ...defaultTressiConfig,
      options: {
        ...defaultTressiConfig.options,
        durationSec: 60,
        rampUpDurationSec: 2,
        threads: 4,
        workerEarlyExit: {
          enabled: false,
          errorRateThreshold: 0,
          exitStatusCodes: [],
          monitoringWindowSeconds: 1,
        },
      },
      requests: [
        {
          earlyExit: {
            enabled: false,
            errorRateThreshold: 0,
            exitStatusCodes: [],
            monitoringWindowSeconds: 1,
          },
          headers: {},
          method: 'GET',
          payload: {},
          rampUpDurationSec: 5,
          rps: 10,
          url: 'http://test.com',
        },
      ],
    },
    epochCreatedAt: 1000,
    epochUpdatedAt: 2000,
    id: '1',
    name: 'Test Config',
  };

  beforeEach(async () => {
    mockTimeService = {
      getRelativeTimeString: vi.fn().mockReturnValue('2 minutes ago'),
    };

    await TestBed.configureTestingModule({
      imports: [ConfigCardComponent],
      providers: [{ provide: TimeService, useValue: mockTimeService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('input', mockConfig);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the config name as title', () => {
    expect(component.input().name).toBe('Test Config');
  });

  it('should display relative time in subtitle', () => {
    expect(mockTimeService.getRelativeTimeString).toHaveBeenCalledWith(2000);
  });

  describe('toggleCollapsed', () => {
    it('should update collapsed signal when startViewTransition is not available', () => {
      const original = document.startViewTransition;
      document.startViewTransition = undefined;

      component.toggleCollapsed(false);
      expect(component.collapsed()).toBe(false);

      document.startViewTransition = original;
    });

    it('should update collapsed signal within startViewTransition when available', () => {
      const mockStartViewTransition = vi.fn((cb: () => void | Promise<void>): ViewTransition => {
        cb();
        return {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          skipTransition: (): void => {},
          types: new Set<string>(),
          updateCallbackDone: Promise.resolve(),
        };
      });
      document.startViewTransition = mockStartViewTransition;

      component.toggleCollapsed(false);
      expect(mockStartViewTransition).toHaveBeenCalled();
      expect(component.collapsed()).toBe(false);

      document.startViewTransition = undefined;
    });
  });

  describe('Calculated properties', () => {
    it('getEffectiveRampUpDuration should return the max of global and endpoint ramp up', () => {
      fixture.componentRef.setInput('input', {
        ...mockConfig,
        config: {
          ...mockConfig.config,
          options: { ...mockConfig.config.options, rampUpDurationSec: 10 },
          requests: [
            { ...mockConfig.config.requests[0], rampUpDurationSec: 5 },
            { ...mockConfig.config.requests[0], rampUpDurationSec: 15 },
          ],
        },
      });
      expect(component.getEffectiveRampUpDuration()).toBe(15);

      fixture.componentRef.setInput('input', {
        ...mockConfig,
        config: {
          ...mockConfig.config,
          options: { ...mockConfig.config.options, rampUpDurationSec: 20 },
          requests: [
            { ...mockConfig.config.requests[0], rampUpDurationSec: 5 },
            { ...mockConfig.config.requests[0], rampUpDurationSec: 15 },
          ],
        },
      });
      expect(component.getEffectiveRampUpDuration()).toBe(20);
    });

    it('getTotalEndpoints should return the number of requests', () => {
      expect(component.getTotalEndpoints()).toBe(1);
    });

    it('getTotalRPS should return the sum of RPS', () => {
      fixture.componentRef.setInput('input', {
        ...mockConfig,
        config: {
          ...mockConfig.config,
          requests: [
            { ...mockConfig.config.requests[0], rps: 10 },
            { ...mockConfig.config.requests[0], rps: 20 },
          ],
        },
      });
      expect(component.getTotalRPS()).toBe(30);
    });

    it('getEffectiveEarlyExitStatus should return true if global or any endpoint has it enabled', () => {
      // Both disabled
      fixture.componentRef.setInput('input', {
        ...mockConfig,
        config: {
          ...mockConfig.config,
          options: {
            ...mockConfig.config.options,
            workerEarlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [],
              monitoringWindowSeconds: 1,
            },
          },
          requests: [
            {
              ...mockConfig.config.requests[0],
              earlyExit: {
                enabled: false,
                errorRateThreshold: 0,
                exitStatusCodes: [],
                monitoringWindowSeconds: 1,
              },
            },
          ],
        },
      });
      expect(component.getEffectiveEarlyExitStatus()).toBe(false);

      // Global enabled
      fixture.componentRef.setInput('input', {
        ...mockConfig,
        config: {
          ...mockConfig.config,
          options: {
            ...mockConfig.config.options,
            workerEarlyExit: {
              enabled: true,
              errorRateThreshold: 0.1,
              exitStatusCodes: [500],
              monitoringWindowSeconds: 1,
            },
          },
          requests: [
            {
              ...mockConfig.config.requests[0],
              earlyExit: {
                enabled: false,
                errorRateThreshold: 0,
                exitStatusCodes: [],
                monitoringWindowSeconds: 1,
              },
            },
          ],
        },
      });
      expect(component.getEffectiveEarlyExitStatus()).toBe(true);

      // Endpoint enabled
      fixture.componentRef.setInput('input', {
        ...mockConfig,
        config: {
          ...mockConfig.config,
          options: {
            ...mockConfig.config.options,
            workerEarlyExit: {
              enabled: false,
              errorRateThreshold: 0,
              exitStatusCodes: [],
              monitoringWindowSeconds: 1,
            },
          },
          requests: [
            {
              ...mockConfig.config.requests[0],
              earlyExit: {
                enabled: true,
                errorRateThreshold: 0.1,
                exitStatusCodes: [500],
                monitoringWindowSeconds: 1,
              },
            },
          ],
        },
      });
      expect(component.getEffectiveEarlyExitStatus()).toBe(true);
    });
  });

  describe('hasPayload', () => {
    it('should return true if payload is a non-empty object', () => {
      const request = {
        ...mockConfig.config.requests[0],
        payload: { key: 'value' },
      };
      expect(component.hasPayload(request)).toBe(true);
    });

    it('should return false if payload is an empty object', () => {
      const request = { ...mockConfig.config.requests[0], payload: {} };
      expect(component.hasPayload(request)).toBe(false);
    });

    it('should return true if payload is a non-empty array', () => {
      const request = { ...mockConfig.config.requests[0], payload: [1, 2] };
      expect(component.hasPayload(request)).toBe(true);
    });

    it('should return false if payload is an empty array', () => {
      const request = { ...mockConfig.config.requests[0], payload: [] };
      expect(component.hasPayload(request)).toBe(false);
    });

    it('should return false if payload is null or undefined', () => {
      const request1 = {
        ...mockConfig.config.requests[0],
        payload: null as unknown as TressiRequestConfig['payload'],
      };
      const request2 = {
        ...mockConfig.config.requests[0],
        payload: undefined as unknown as TressiRequestConfig['payload'],
      };
      expect(component.hasPayload(request1)).toBe(false);
      expect(component.hasPayload(request2)).toBe(false);
    });
  });

  describe('Outputs', () => {
    it('should emit edit event when edit output is called', () => {
      const spy = vi.spyOn(component.edit, 'emit');
      component.edit.emit(mockConfig);
      expect(spy).toHaveBeenCalledWith(mockConfig);
    });

    it('should emit duplicate event when duplicate output is called', () => {
      const spy = vi.spyOn(component.duplicate, 'emit');
      component.duplicate.emit(mockConfig);
      expect(spy).toHaveBeenCalledWith(mockConfig);
    });

    it('should emit delete event when delete output is called', () => {
      const spy = vi.spyOn(component.delete, 'emit');
      component.delete.emit(mockConfig);
      expect(spy).toHaveBeenCalledWith(mockConfig);
    });

    it('should emit navigate event when navigate output is called', () => {
      const spy = vi.spyOn(component.navigate, 'emit');
      component.navigate.emit(mockConfig);
      expect(spy).toHaveBeenCalledWith(mockConfig);
    });
  });
});

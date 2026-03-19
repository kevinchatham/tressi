import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type ConfigDocument, defaultTressiConfig } from '@tressi/shared/common';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventService } from '../../services/event.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { AppRouterService } from '../../services/router.service';
import { TitleService } from '../../services/title.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAppRouter: {
    toWelcome: ReturnType<typeof vi.fn>;
    updateDashboardUrl: ReturnType<typeof vi.fn>;
    toConfigs: ReturnType<typeof vi.fn>;
    isOnDocs: ReturnType<typeof vi.fn>;
    isOnServerUnavailable: ReturnType<typeof vi.fn>;
    toDocs: ReturnType<typeof vi.fn>;
  };
  let mockLogService: {
    error: ReturnType<typeof vi.fn>;
  };
  let mockLocalStorageService: {
    preferences: ReturnType<typeof vi.fn>;
    savePreferences: ReturnType<typeof vi.fn>;
  };
  let mockEventService: {
    getTestEventsStream: ReturnType<typeof vi.fn>;
    getMetricsStream: ReturnType<typeof vi.fn>;
    getConnectedStream: ReturnType<typeof vi.fn>;
    getErrorStream: ReturnType<typeof vi.fn>;
  };
  let testEventsSubject: Subject<{ status: string }>;

  const mockConfigs: ConfigDocument[] = [
    {
      config: defaultTressiConfig,
      epochCreatedAt: 123,
      epochUpdatedAt: 123,
      id: 'config-1',
      name: 'Config 1',
    },
    {
      config: defaultTressiConfig,
      epochCreatedAt: 456,
      epochUpdatedAt: 456,
      id: 'config-2',
      name: 'Config 2',
    },
  ];

  beforeEach(async () => {
    mockAppRouter = {
      isOnDocs: vi.fn().mockReturnValue(false),
      isOnServerUnavailable: vi.fn().mockReturnValue(false),
      toConfigs: vi.fn(),
      toDocs: vi.fn(),
      toWelcome: vi.fn(),
      updateDashboardUrl: vi.fn(),
    };

    mockLogService = {
      error: vi.fn(),
    };

    mockLocalStorageService = {
      preferences: vi.fn().mockReturnValue({}),
      savePreferences: vi.fn(),
    };

    testEventsSubject = new Subject();
    mockEventService = {
      getConnectedStream: vi.fn().mockReturnValue(new Subject().asObservable()),
      getErrorStream: vi.fn().mockReturnValue(new Subject().asObservable()),
      getMetricsStream: vi.fn().mockReturnValue(new Subject().asObservable()),
      getTestEventsStream: vi.fn().mockReturnValue(testEventsSubject.asObservable()),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: AppRouterService, useValue: mockAppRouter },
        { provide: LogService, useValue: mockLogService },
        { provide: LocalStorageService, useValue: mockLocalStorageService },
        { provide: EventService, useValue: mockEventService },
      ],
    }).compileComponents();

    TestBed.inject(TitleService);

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('configs', mockConfigs);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should redirect to welcome if no configs are provided', () => {
      fixture.componentRef.setInput('configs', []);
      fixture.detectChanges();
      expect(mockAppRouter.toWelcome).toHaveBeenCalled();
    });

    it('should select config from route if provided and valid', () => {
      fixture.componentRef.setInput('configs', mockConfigs);
      fixture.componentRef.setInput('configId', 'config-2');
      fixture.detectChanges();
      expect(component.selectedConfig()?.id).toBe('config-2');
    });

    it('should select last selected config from local storage if no route configId', () => {
      mockLocalStorageService.preferences.mockReturnValue({
        lastSelectedConfig: mockConfigs[1],
      });
      fixture.componentRef.setInput('configs', mockConfigs);
      fixture.detectChanges();
      expect(component.selectedConfig()?.id).toBe('config-2');
    });

    it('should fallback to first config if no route configId and no last selected config', () => {
      fixture.componentRef.setInput('configs', mockConfigs);
      fixture.detectChanges();
      expect(component.selectedConfig()?.id).toBe('config-1');
    });

    it('should fallback to first config if last selected config is no longer in the list', () => {
      mockLocalStorageService.preferences.mockReturnValue({
        lastSelectedConfig: { id: 'old-config' } as unknown as ConfigDocument,
      });
      fixture.componentRef.setInput('configs', mockConfigs);
      fixture.detectChanges();
      expect(component.selectedConfig()?.id).toBe('config-1');
    });
  });

  describe('Config Selection', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('configs', mockConfigs);
      fixture.detectChanges();
    });

    it('should update selectedConfig and save to local storage when onConfigSelect is called', () => {
      component.onConfigSelect('config-2');
      expect(component.selectedConfig()?.id).toBe('config-2');
      expect(mockLocalStorageService.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ lastSelectedConfig: mockConfigs[1] }),
      );
      expect(mockAppRouter.updateDashboardUrl).toHaveBeenCalledWith('config-2');
    });

    it('should handle config selection from event', () => {
      const event = {
        target: { value: 'config-2' },
      } as unknown as Event;
      component.onConfigSelectEvent(event);
      expect(component.selectedConfig()?.id).toBe('config-2');
    });

    it('should set selectedConfig to null if event target value is empty', () => {
      const event = {
        target: { value: '' },
      } as unknown as Event;
      component.onConfigSelectEvent(event);
      expect(component.selectedConfig()).toBeNull();
    });
  });

  describe('Test Events', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('configs', mockConfigs);
      fixture.detectChanges();
    });

    it('should set isTestRunning to true when a test starts running', () => {
      testEventsSubject.next({ status: 'running' });
      expect(component.isTestRunning()).toBe(true);
    });

    it('should set isTestRunning to false when a test completes', () => {
      component.isTestRunning.set(true);
      testEventsSubject.next({ status: 'completed' });
      expect(component.isTestRunning()).toBe(false);
    });

    it('should set isTestRunning to false when a test fails', () => {
      component.isTestRunning.set(true);
      testEventsSubject.next({ status: 'failed' });
      expect(component.isTestRunning()).toBe(false);
    });

    it('should set isTestRunning to false when a test is cancelled', () => {
      component.isTestRunning.set(true);
      testEventsSubject.next({ status: 'cancelled' });
      expect(component.isTestRunning()).toBe(false);
    });

    it('should log error if test event stream fails', () => {
      testEventsSubject.error(new Error('Stream failed'));
      expect(mockLogService.error).toHaveBeenCalledWith(
        'Failed to handle test event:',
        expect.any(Error),
      );
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('configs', mockConfigs);
      fixture.detectChanges();
    });

    it('should refresh tests when onTestStarted is called', () => {
      const mockTestList = { refreshTests: vi.fn() };
      vi.spyOn(component, 'testListComponent').mockReturnValue(mockTestList as never);

      component.onTestStarted();
      expect(mockTestList.refreshTests).toHaveBeenCalled();
    });

    it('should log error when onTestStartFailed is called', () => {
      const error = new Error('Start failed');
      component.onTestStartFailed(error);
      expect(mockLogService.error).toHaveBeenCalledWith('Failed to start test:', error);
    });

    it('should update hasTestHistory when onTestHistoryUpdate is called', () => {
      component.onTestHistoryUpdate(true);
      expect(component.hasTestHistory()).toBe(true);
      component.onTestHistoryUpdate(false);
      expect(component.hasTestHistory()).toBe(false);
    });
  });

  describe('Reactive Effects', () => {
    it('should update selection when configId input changes', () => {
      fixture.componentRef.setInput('configs', mockConfigs);
      fixture.detectChanges();

      // Initially config-1 is selected (fallback)
      expect(component.selectedConfig()?.id).toBe('config-1');

      // Change configId input
      fixture.componentRef.setInput('configId', 'config-2');
      fixture.detectChanges();

      expect(component.selectedConfig()?.id).toBe('config-2');
    });
  });
});

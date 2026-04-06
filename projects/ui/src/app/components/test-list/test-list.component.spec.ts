import { TestBed } from '@angular/core/testing';
import type {
  ConfigDocument,
  GlobalSummary,
  LatencyHistogram,
  TestDocument,
  TestEventData,
  TestSummary,
} from '@tressi/shared/common';
import type { DeleteResult } from '@tressi/shared/ui';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { AppRouterService } from '../../services/router.service';
import { TestService } from '../../services/test.service';
import { TestListComponent } from './test-list.component';
import { TestListColumnsService } from './test-list-columns.service';
import { TestListDeleteService } from './test-list-delete.service';
import { TestListSelectionService } from './test-list-selection.service';

const createMockHistogram = (): LatencyHistogram => ({
  buckets: [],
  max: 500,
  mean: 75,
  min: 10,
  percentiles: { 50: 50, 95: 200, 99: 400 },
  stdDev: 50,
  totalCount: 1000,
});

const createMockGlobalSummary = (overrides: Partial<GlobalSummary> = {}): GlobalSummary => ({
  averageRequestsPerSecond: 16.67,
  avgProcessMemoryUsageMB: 128,
  avgSystemCpuUsagePercent: 45,
  earlyExitTriggered: false,
  epochEndedAt: Date.now(),
  epochStartedAt: Date.now() - 60000,
  errorRate: 0.05,
  failedRequests: 50,
  finalDurationSec: 60,
  histogram: createMockHistogram(),
  maxLatencyMs: 500,
  minLatencyMs: 10,
  networkBytesPerSec: 83.33,
  networkBytesReceived: 5000,
  networkBytesSent: 1000,
  p50LatencyMs: 50,
  p95LatencyMs: 200,
  p99LatencyMs: 400,
  peakRequestsPerSecond: 20,
  successfulRequests: 950,
  targetAchieved: 0.85,
  totalEndpoints: 1,
  totalRequests: 1000,
  ...overrides,
});

const createMockSummary = (overrides: Partial<TestSummary> = {}): TestSummary => ({
  configSnapshot: {
    $schema: 'https://json-schema.org/draft-07/schema#',
    options: {
      durationSec: 60,
      headers: {},
      rampUpDurationSec: 0,
      threads: 1,
      workerEarlyExit: {
        enabled: false,
        errorRateThreshold: 5,
        exitStatusCodes: [],
        monitoringWindowSeconds: 10,
      },
      workerMemoryLimit: 512,
    },
    requests: [],
  },
  endpoints: [],
  global: createMockGlobalSummary(),
  tressiVersion: '1.0.0',
  ...overrides,
});

const createMockTest = (
  id: string,
  status: 'running' | 'completed' | 'failed' = 'completed',
): TestDocument => ({
  configId: 'config-1',
  epochCreatedAt: Date.now(),
  error: status === 'failed' ? 'Test failed' : null,
  id,
  status,
  summary: status !== 'running' ? createMockSummary() : null,
});

const mockConfig: ConfigDocument = {
  config: {
    $schema: 'https://json-schema.org/draft-07/schema#',
    options: {
      durationSec: 60,
      headers: {},
      rampUpDurationSec: 0,
      threads: 1,
      workerEarlyExit: {
        enabled: false,
        errorRateThreshold: 5,
        exitStatusCodes: [],
        monitoringWindowSeconds: 10,
      },
      workerMemoryLimit: 512,
    },
    requests: [],
  },
  epochCreatedAt: Date.now(),
  epochUpdatedAt: Date.now(),
  id: 'config-1',
  name: 'Test Config',
};

describe('TestListComponent', () => {
  let component: TestListComponent;
  let testServiceMock: {
    getTestsByConfigId: ReturnType<typeof vi.fn>;
    getTestById: ReturnType<typeof vi.fn>;
  };
  let eventServiceMock: {
    getMetricsStream: ReturnType<typeof vi.fn>;
    getTestEventsStream: ReturnType<typeof vi.fn>;
  };
  let deleteServiceMock: {
    deleteTestsWithLoading: ReturnType<typeof vi.fn>;
  };
  let columnsServiceMock: {
    visibleColumns: () => unknown[];
    columnGroups: () => unknown;
    currentSort: () => unknown;
    toggleColumn: () => void;
    resetColumns: () => void;
    reorderColumn: () => void;
    toggleSort: () => void;
  };
  let selectionServiceMock: {
    selectedTestsSet: () => Set<string>;
    getSelectedCount: () => number;
    getSelectedIds: ReturnType<typeof vi.fn>;
    isAllSelected: () => boolean;
    isSomeSelected: () => boolean;
    hasRunningTestsSelected: () => boolean;
    toggleTestSelection: () => void;
    toggleAllTests: () => void;
    clearSelection: () => void;
  };
  let logServiceMock: {
    error: () => void;
  };
  let metricsSubject: Subject<{ testSummary: TestSummary }>;
  let testEventsSubject: Subject<TestEventData>;

  beforeEach(async () => {
    metricsSubject = new Subject();
    testEventsSubject = new Subject();

    testServiceMock = {
      getTestById: vi.fn().mockResolvedValue(null),
      getTestsByConfigId: vi.fn().mockResolvedValue([]),
    };

    eventServiceMock = {
      getMetricsStream: vi.fn().mockReturnValue(metricsSubject.asObservable()),
      getTestEventsStream: vi.fn().mockReturnValue(testEventsSubject.asObservable()),
    };

    deleteServiceMock = {
      deleteTestsWithLoading: vi.fn().mockResolvedValue({
        deletedCount: 0,
        errors: [],
        failedCount: 0,
        success: true,
      } as DeleteResult),
    };

    columnsServiceMock = {
      columnGroups: vi.fn().mockReturnValue({}),
      currentSort: vi.fn().mockReturnValue(null),
      reorderColumn: vi.fn(),
      resetColumns: vi.fn(),
      toggleColumn: vi.fn(),
      toggleSort: vi.fn(),
      visibleColumns: vi.fn().mockReturnValue([]),
    };

    selectionServiceMock = {
      clearSelection: vi.fn(),
      getSelectedCount: vi.fn().mockReturnValue(0),
      getSelectedIds: vi.fn().mockReturnValue(new Set<string>()),
      hasRunningTestsSelected: vi.fn().mockReturnValue(false),
      isAllSelected: vi.fn().mockReturnValue(false),
      isSomeSelected: vi.fn().mockReturnValue(false),
      selectedTestsSet: vi.fn().mockReturnValue(new Set()),
      toggleAllTests: vi.fn(),
      toggleTestSelection: vi.fn(),
    };

    logServiceMock = {
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        TestListComponent,
        { provide: TestService, useValue: testServiceMock },
        { provide: EventService, useValue: eventServiceMock },
        { provide: AppRouterService, useValue: {} },
        { provide: TestListColumnsService, useValue: columnsServiceMock },
        { provide: TestListSelectionService, useValue: selectionServiceMock },
        { provide: TestListDeleteService, useValue: deleteServiceMock },
        { provide: LogService, useValue: logServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', mockConfig);
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('config input', () => {
    it('should set configName from config input', () => {
      expect(component.configName()).toBe('Test Config');
    });
  });

  describe('computed signals', () => {
    it('should compute hasError correctly', () => {
      expect(component.hasError()).toBe(false);
    });

    it('should compute hasTests correctly when no tests', () => {
      expect(component.hasTests()).toBe(false);
    });

    it('should compute pageTitle correctly', () => {
      expect(component.pageTitle()).toBe('Test History - Test Config');
    });
  });

  describe('loadTests', () => {
    it('should load tests successfully', async () => {
      const mockTests = [createMockTest('test-1'), createMockTest('test-2')];
      testServiceMock.getTestsByConfigId.mockResolvedValue(mockTests);

      await component.loadTests();

      expect(testServiceMock.getTestsByConfigId).toHaveBeenCalledWith('config-1');
    });

    it('should set error on load failure', async () => {
      testServiceMock.getTestsByConfigId.mockRejectedValue(new Error('Load failed'));

      await component.loadTests();

      expect(component.hasError()).toBe(true);
      expect(component.errorMessage()).toBe('Load failed');
    });

    it('should emit testHistoryUpdate with true when tests exist', async () => {
      const mockTests = [createMockTest('test-1')];
      testServiceMock.getTestsByConfigId.mockResolvedValue(mockTests);
      const emitSpy = vi.spyOn(component.testHistoryUpdate, 'emit');

      await component.loadTests();

      expect(emitSpy).toHaveBeenCalledWith(true);
    });

    it('should emit testHistoryUpdate with false when no tests', async () => {
      testServiceMock.getTestsByConfigId.mockResolvedValue([]);
      const emitSpy = vi.spyOn(component.testHistoryUpdate, 'emit');

      await component.loadTests();

      expect(emitSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('refreshTests', () => {
    it('should call loadTests', async () => {
      const loadTestsSpy = vi.spyOn(component, 'loadTests');
      await component.refreshTests();
      expect(loadTestsSpy).toHaveBeenCalled();
    });
  });

  describe('onTestStarted', () => {
    it('should call refreshTests', () => {
      const refreshSpy = vi.spyOn(component, 'refreshTests');
      component.onTestStarted();
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('onTestStartFailed', () => {
    it('should log the error', () => {
      const error = new Error('Start failed');
      component.onTestStartFailed(error);
      expect(logServiceMock.error).toHaveBeenCalledWith('Failed to start test:', error);
    });
  });

  describe('column management', () => {
    it('should toggle column', () => {
      component.toggleColumn('totalRequests');
      expect(columnsServiceMock.toggleColumn).toHaveBeenCalledWith('totalRequests');
    });

    it('should reset columns', () => {
      component.resetColumns();
      expect(columnsServiceMock.resetColumns).toHaveBeenCalled();
    });

    it('should handle column reorder', () => {
      component.onColumnReorder({ draggedKey: 'col1', targetKey: 'col2' });
      expect(columnsServiceMock.reorderColumn).toHaveBeenCalledWith('col1', 'col2');
    });

    it('should handle column sort', () => {
      component.onColumnSort('totalRequests');
      expect(columnsServiceMock.toggleSort).toHaveBeenCalledWith('totalRequests');
    });

    it('should toggle column selector', () => {
      expect(component.showColumnSelector()).toBe(false);
      component.toggleColumnSelector();
      expect(component.showColumnSelector()).toBe(true);
      component.toggleColumnSelector();
      expect(component.showColumnSelector()).toBe(false);
    });

    it('should close column selector', () => {
      component.showColumnSelector.set(true);
      component.closeColumnSelector();
      expect(component.showColumnSelector()).toBe(false);
    });
  });

  describe('selection management', () => {
    it('should toggle test selection', () => {
      const event = {} as Event;
      component.toggleTestSelection('test-1', event);
      expect(selectionServiceMock.toggleTestSelection).toHaveBeenCalledWith('test-1', event);
    });

    it('should toggle all tests', () => {
      const event = {} as Event;
      component.toggleAllTests(event);
      expect(selectionServiceMock.toggleAllTests).toHaveBeenCalled();
    });
  });

  describe('delete functionality', () => {
    it('should show delete confirm', () => {
      const test = createMockTest('test-1');
      const event = { stopPropagation: vi.fn() } as unknown as Event;

      component.showDeleteConfirm(test, event);

      expect(component.testToDelete()).toBe(test);
      expect(component.showDeleteModal()).toBe(true);
    });

    it('should show delete confirm with null test', () => {
      const event = { stopPropagation: vi.fn() } as unknown as Event;

      component.showDeleteConfirm(null, event);

      expect(component.testToDelete()).toBeNull();
      expect(component.showDeleteModal()).toBe(true);
    });

    it('should cancel delete', () => {
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.showDeleteConfirm(createMockTest('test-1'), event);

      component.cancelDelete();

      expect(component.showDeleteModal()).toBe(false);
      expect(component.testToDelete()).toBeNull();
      expect(selectionServiceMock.clearSelection).toHaveBeenCalled();
    });

    it('should deleteSelectedTests', async () => {
      selectionServiceMock.getSelectedIds.mockReturnValue(new Set(['test-1', 'test-2']));

      await component.deleteSelectedTests();

      expect(deleteServiceMock.deleteTestsWithLoading).toHaveBeenCalledWith(['test-1', 'test-2']);
    });

    it('should not delete if no tests selected', async () => {
      selectionServiceMock.getSelectedIds.mockReturnValue(new Set());

      await component.deleteSelectedTests();

      expect(deleteServiceMock.deleteTestsWithLoading).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('should load tests when config changes', () => {
      const loadTestsSpy = vi.spyOn(component, 'loadTests');
      const newConfig = { ...mockConfig, id: 'config-2', name: 'New Config' };

      component.ngOnChanges({
        config: {
          currentValue: newConfig,
          firstChange: false,
          isFirstChange: () => false,
          previousValue: mockConfig,
        },
      });

      expect(loadTestsSpy).toHaveBeenCalled();
    });

    it('should not load tests if config change has no currentValue', () => {
      const loadTestsSpy = vi.spyOn(component, 'loadTests');

      component.ngOnChanges({});

      expect(loadTestsSpy).not.toHaveBeenCalled();
    });
  });

  describe('service integration', () => {
    it('should expose visibleColumns from columns service', () => {
      expect(component.visibleColumns).toBeDefined();
    });

    it('should expose columnGroups from columns service', () => {
      expect(component.columnGroups).toBeDefined();
    });

    it('should expose currentSort from columns service', () => {
      expect(component.currentSort).toBeDefined();
    });

    it('should expose selectedTests from selection service', () => {
      expect(component.selectedTests).toBeDefined();
    });

    it('should expose selectedTestsCount computed', () => {
      expect(component.selectedTestsCount()).toBe(0);
    });
  });
});

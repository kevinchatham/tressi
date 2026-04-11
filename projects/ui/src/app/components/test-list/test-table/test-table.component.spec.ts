import { TestBed } from '@angular/core/testing';
import type { LatencyHistogram, TestDocument, TestSummary } from '@tressi/shared/common';
import { type ColumnConfig, ColumnKey, type FieldPath } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TestService } from '../../../services/test.service';
import { TestTableComponent } from './test-table.component';

const createHistogram = (): LatencyHistogram => ({
  buckets: [],
  max: 0,
  mean: 0,
  min: 0,
  percentiles: {},
  stdDev: 0,
  totalCount: 0,
});

const createColumnConfig = (overrides: Partial<ColumnConfig> = {}): ColumnConfig => ({
  draggable: true,
  field: 'test.status',
  group: 'basic',
  key: ColumnKey.STATUS,
  label: 'Status',
  order: 1,
  sortable: true,
  visible: true,
  width: 100,
  ...overrides,
});

describe('TestTableComponent', () => {
  let component: TestTableComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TestService,
          useValue: { getTestDuration: vi.fn().mockReturnValue(0) },
        },
      ],
    });
    const fixture = TestBed.createComponent(TestTableComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('tests', []);
    fixture.componentRef.setInput('columns', []);
    fixture.componentRef.setInput('selectedTests', new Set());
    fixture.componentRef.setInput('isAllSelected', false);
    fixture.componentRef.setInput('isSomeSelected', false);
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('getColumnValue', () => {
    it('should return empty string for select column', () => {
      const mockTest: TestDocument = {
        configId: 'config-1',
        epochCreatedAt: 1000,
        error: null,
        id: 'test-1',
        status: 'completed',
        summary: null,
      };
      const result = component.getColumnValue(
        mockTest,
        createColumnConfig({ field: 'select', key: ColumnKey.SELECT }),
      );
      expect(result).toBe('');
    });

    it('should return null for unknown column field', () => {
      const mockTest: TestDocument = {
        configId: 'config-1',
        epochCreatedAt: 1000,
        error: null,
        id: 'test-1',
        status: 'completed',
        summary: null,
      };
      const result = component.getColumnValue(
        mockTest,
        createColumnConfig({ field: 'unknown' as FieldPath }),
      );
      expect(result).toBeNull();
    });

    it('should extract test status', () => {
      const mockTest: TestDocument = {
        configId: 'config-1',
        epochCreatedAt: 1000,
        error: null,
        id: 'test-1',
        status: 'running',
        summary: null,
      };
      const result = component.getColumnValue(
        mockTest,
        createColumnConfig({ field: 'test.status' }),
      );
      expect(result).toBe('running');
    });

    it('should return unknown for missing test status', () => {
      const mockTest: TestDocument = {
        configId: 'config-1',
        epochCreatedAt: 1000,
        error: null,
        id: 'test-1',
        status: undefined as unknown as 'completed',
        summary: null,
      };
      const result = component.getColumnValue(
        mockTest,
        createColumnConfig({ field: 'test.status' }),
      );
      expect(result).toBe('unknown');
    });
  });

  describe('getTestDurationRaw', () => {
    it('should return embedded finalDurationSec when available', () => {
      const mockTest: TestDocument = {
        configId: 'config-1',
        epochCreatedAt: 1000,
        error: null,
        id: 'test-1',
        status: 'completed',
        summary: {
          configSnapshot: {} as TestSummary['configSnapshot'],
          endpoints: [],
          global: {
            averageRequestsPerSecond: 100,
            avgProcessMemoryUsageMB: 0,
            avgSystemCpuUsagePercent: 0,
            earlyExitTriggered: false,
            epochEndedAt: 7000,
            epochStartedAt: 1000,
            errorRate: 0,
            failedRequests: 0,
            finalDurationSec: 120,
            histogram: createHistogram(),
            maxLatencyMs: 100,
            minLatencyMs: 1,
            networkBytesPerSec: 0,
            networkBytesReceived: 0,
            networkBytesSent: 0,
            p50LatencyMs: 50,
            p95LatencyMs: 95,
            p99LatencyMs: 99,
            peakRequestsPerSecond: 200,
            successfulRequests: 100,
            targetAchieved: 0,
            totalEndpoints: 1,
            totalRequests: 100,
          },
          tressiVersion: '1.0.0',
        },
      };
      const result = component.getTestDurationRaw(mockTest);
      expect(result).toBe(120);
    });

    it('should calculate duration from timestamps for completed tests', () => {
      const mockTest: TestDocument = {
        configId: 'config-1',
        epochCreatedAt: 1000,
        error: null,
        id: 'test-1',
        status: 'completed',
        summary: {
          configSnapshot: {} as TestSummary['configSnapshot'],
          endpoints: [],
          global: {
            averageRequestsPerSecond: 100,
            avgProcessMemoryUsageMB: 0,
            avgSystemCpuUsagePercent: 0,
            earlyExitTriggered: false,
            epochEndedAt: 7000,
            epochStartedAt: 1000,
            errorRate: 0,
            failedRequests: 0,
            finalDurationSec: undefined as unknown as number,
            histogram: createHistogram(),
            maxLatencyMs: 100,
            minLatencyMs: 1,
            networkBytesPerSec: 0,
            networkBytesReceived: 0,
            networkBytesSent: 0,
            p50LatencyMs: 50,
            p95LatencyMs: 95,
            p99LatencyMs: 99,
            peakRequestsPerSecond: 200,
            successfulRequests: 100,
            targetAchieved: 0,
            totalEndpoints: 1,
            totalRequests: 100,
          },
          tressiVersion: '1.0.0',
        },
      };
      const result = component.getTestDurationRaw(mockTest);
      expect(result).toBe(6);
    });

    it('should fallback to testService for non-completed tests', () => {
      const getDurationSpy = vi.spyOn(TestBed.inject(TestService), 'getTestDuration');
      getDurationSpy.mockReturnValue(5000);
      const mockTest: TestDocument = {
        configId: 'config-1',
        epochCreatedAt: 1000,
        error: null,
        id: 'test-1',
        status: 'running',
        summary: {
          configSnapshot: {} as TestSummary['configSnapshot'],
          endpoints: [],
          global: {
            averageRequestsPerSecond: 100,
            avgProcessMemoryUsageMB: 0,
            avgSystemCpuUsagePercent: 0,
            earlyExitTriggered: false,
            epochEndedAt: 7000,
            epochStartedAt: 1000,
            errorRate: 0,
            failedRequests: 0,
            finalDurationSec: undefined as unknown as number,
            histogram: createHistogram(),
            maxLatencyMs: 100,
            minLatencyMs: 1,
            networkBytesPerSec: 0,
            networkBytesReceived: 0,
            networkBytesSent: 0,
            p50LatencyMs: 50,
            p95LatencyMs: 95,
            p99LatencyMs: 99,
            peakRequestsPerSecond: 200,
            successfulRequests: 100,
            targetAchieved: 0,
            totalEndpoints: 1,
            totalRequests: 100,
          },
          tressiVersion: '1.0.0',
        },
      };
      const result = component.getTestDurationRaw(mockTest);
      expect(result).toBe(5);
    });
  });

  describe('outputs', () => {
    it('onViewTest should emit viewTest with testId', () => {
      const spy = vi.spyOn(component.viewTest, 'emit');
      component.onViewTest('test-123');
      expect(spy).toHaveBeenCalledWith('test-123');
    });

    it('onToggleSelection should emit toggleSelection with testId and event', () => {
      const spy = vi.spyOn(component.toggleSelection, 'emit');
      const event = new Event('click');
      component.onToggleSelection('test-456', event);
      expect(spy).toHaveBeenCalledWith({ event, testId: 'test-456' });
    });

    it('onToggleAllSelection should emit toggleAllSelection with event', () => {
      const spy = vi.spyOn(component.toggleAllSelection, 'emit');
      const event = new Event('click');
      component.onToggleAllSelection(event);
      expect(spy).toHaveBeenCalledWith(event);
    });
  });

  describe('onToggleStatus', () => {
    it('should emit toggleSelection for all tests with matching status', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);

      const spy = vi.spyOn(testComponent.toggleSelection, 'emit');
      const event = new Event('click');
      const tests: TestDocument[] = [
        {
          configId: 'config-1',
          epochCreatedAt: 1000,
          error: null,
          id: 'test-1',
          status: 'completed',
          summary: null,
        },
        {
          configId: 'config-1',
          epochCreatedAt: 1000,
          error: null,
          id: 'test-2',
          status: 'running',
          summary: null,
        },
        {
          configId: 'config-1',
          epochCreatedAt: 1000,
          error: null,
          id: 'test-3',
          status: 'completed',
          summary: null,
        },
      ];
      fixture.componentRef.setInput('tests', tests);

      testComponent.onToggleStatus('completed', event);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith({ event, testId: 'test-1' });
      expect(spy).toHaveBeenCalledWith({ event, testId: 'test-3' });
    });

    it('should not emit for tests with non-matching status', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);

      const spy = vi.spyOn(testComponent.toggleSelection, 'emit');
      const event = new Event('click');
      const tests: TestDocument[] = [
        {
          configId: 'config-1',
          epochCreatedAt: 1000,
          error: null,
          id: 'test-1',
          status: 'running',
          summary: null,
        },
        {
          configId: 'config-1',
          epochCreatedAt: 1000,
          error: null,
          id: 'test-2',
          status: 'failed',
          summary: null,
        },
      ];
      fixture.componentRef.setInput('tests', tests);

      testComponent.onToggleStatus('completed', event);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('onColumnHeaderClick', () => {
    it('should emit columnSort when column is sortable', () => {
      const spy = vi.spyOn(component.columnSort, 'emit');
      component.onColumnHeaderClick(createColumnConfig({ field: 'test.status', sortable: true }));
      expect(spy).toHaveBeenCalledWith(ColumnKey.STATUS);
    });

    it('should not emit when column is not sortable', () => {
      const spy = vi.spyOn(component.columnSort, 'emit');
      component.onColumnHeaderClick(createColumnConfig({ field: 'test.status', sortable: false }));
      expect(spy).not.toHaveBeenCalled();
    });

    it('should not emit for SELECT column', () => {
      const spy = vi.spyOn(component.columnSort, 'emit');
      component.onColumnHeaderClick(
        createColumnConfig({ field: 'select', key: ColumnKey.SELECT, sortable: true }),
      );
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getSortIcon', () => {
    it('should return null when currentSort is null', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);
      fixture.componentRef.setInput('currentSort', null);

      const result = testComponent.getSortIcon(ColumnKey.STATUS);
      expect(result).toBeNull();
    });

    it('should return null when columnKey does not match sort column', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);
      fixture.componentRef.setInput('currentSort', {
        columnKey: ColumnKey.DURATION,
        direction: 'asc',
      });

      const result = testComponent.getSortIcon(ColumnKey.STATUS);
      expect(result).toBeNull();
    });

    it('should return keyboard_arrow_up for ascending sort on matching column', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);
      fixture.componentRef.setInput('currentSort', {
        columnKey: ColumnKey.STATUS,
        direction: 'asc',
      });

      const result = testComponent.getSortIcon(ColumnKey.STATUS);
      expect(result).toBe('keyboard_arrow_up');
    });

    it('should return keyboard_arrow_down for descending sort on matching column', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);
      fixture.componentRef.setInput('currentSort', {
        columnKey: ColumnKey.STATUS,
        direction: 'desc',
      });

      const result = testComponent.getSortIcon(ColumnKey.STATUS);
      expect(result).toBe('keyboard_arrow_down');
    });
  });

  describe('isColumnSorted', () => {
    it('should return false when currentSort is null', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);
      fixture.componentRef.setInput('currentSort', null);

      const result = testComponent.isColumnSorted(ColumnKey.STATUS);
      expect(result).toBe(false);
    });

    it('should return false when columnKey does not match', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);
      fixture.componentRef.setInput('currentSort', {
        columnKey: ColumnKey.DURATION,
        direction: 'asc',
      });

      const result = testComponent.isColumnSorted(ColumnKey.STATUS);
      expect(result).toBe(false);
    });

    it('should return true when columnKey matches', () => {
      const fixture = TestBed.createComponent(TestTableComponent);
      const testComponent = fixture.componentInstance;
      fixture.componentRef.setInput('tests', []);
      fixture.componentRef.setInput('columns', []);
      fixture.componentRef.setInput('selectedTests', new Set());
      fixture.componentRef.setInput('isAllSelected', false);
      fixture.componentRef.setInput('isSomeSelected', false);
      fixture.componentRef.setInput('currentSort', {
        columnKey: ColumnKey.STATUS,
        direction: 'desc',
      });

      const result = testComponent.isColumnSorted(ColumnKey.STATUS);
      expect(result).toBe(true);
    });
  });
});

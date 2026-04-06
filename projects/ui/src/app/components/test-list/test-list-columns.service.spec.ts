import { TestBed } from '@angular/core/testing';
import type { ColumnConfig } from '@tressi/shared/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageService } from '../../services/local-storage.service';
import { LogService } from '../../services/log.service';
import { ColumnKey } from './column-keys.enum';
import { TestListColumnsService } from './test-list-columns.service';

describe('TestListColumnsService', () => {
  let service: TestListColumnsService;
  let localStorageServiceMock: {
    preferences: (...args: unknown[]) => unknown;
    savePreferences: (...args: unknown[]) => unknown;
  };
  let logServiceMock: { error: (...args: unknown[]) => unknown };

  const createDefaultColumn = (
    key: string,
    overrides: Partial<ColumnConfig> = {},
  ): ColumnConfig => ({
    draggable: true,
    field: 'summary.global.totalRequests',
    format: 'number',
    group: 'basic',
    key,
    label: key,
    order: 0,
    sortable: true,
    visible: true,
    ...overrides,
  });

  beforeEach(() => {
    localStorageServiceMock = {
      preferences: vi.fn().mockReturnValue({ columnPreferences: [] }),
      savePreferences: vi.fn(),
    };
    logServiceMock = {
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TestListColumnsService,
        { provide: LocalStorageService, useValue: localStorageServiceMock },
        { provide: LogService, useValue: logServiceMock },
      ],
    });
    service = TestBed.inject(TestListColumnsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return default columns initially', () => {
    const visible = service.visibleColumns();
    expect(visible.length).toBeGreaterThan(0);
    expect(visible[0].key).toBe(ColumnKey.SELECT);
  });

  it('should toggle column visibility', () => {
    const initialVisible = service.visibleColumns();
    const keyToToggle = initialVisible.find(
      (c) => c.key !== ColumnKey.SELECT && c.key !== ColumnKey.STATUS,
    )?.key;

    if (keyToToggle) {
      service.toggleColumn(keyToToggle);
      const updatedVisible = service.visibleColumns();
      expect(updatedVisible.find((c) => c.key === keyToToggle)).toBeUndefined();
    }
  });

  it('should reset columns', () => {
    service.toggleColumn(ColumnKey.TOTAL_REQUESTS);
    service.resetColumns();
    const visible = service.visibleColumns();
    expect(visible.find((c) => c.key === ColumnKey.TOTAL_REQUESTS)?.visible).toBe(true);
  });

  describe('visibleColumns', () => {
    it('should always include SELECT column first', () => {
      const visible = service.visibleColumns();
      expect(visible[0]?.key).toBe(ColumnKey.SELECT);
    });

    it('should always include STATUS column second', () => {
      const visible = service.visibleColumns();
      expect(visible[1]?.key).toBe(ColumnKey.STATUS);
    });

    it('should exclude actions column from visible columns', () => {
      const visible = service.visibleColumns();
      expect(visible.find((c) => c.key === 'actions')).toBeUndefined();
    });

    it('should sort configurable columns by order', () => {
      const visible = service.visibleColumns();
      const configurableColumns = visible.filter(
        (c) => c.key !== ColumnKey.SELECT && c.key !== ColumnKey.STATUS && c.key !== 'actions',
      );
      for (let i = 1; i < configurableColumns.length; i++) {
        expect(configurableColumns[i - 1].order).toBeLessThanOrEqual(configurableColumns[i].order);
      }
    });
  });

  describe('columnGroups', () => {
    it('should return groups with basic, configuration, latency, network, performance, request', () => {
      const groups = service.columnGroups();
      expect(groups).toHaveProperty('basic');
      expect(groups).toHaveProperty('configuration');
      expect(groups).toHaveProperty('latency');
      expect(groups).toHaveProperty('network');
      expect(groups).toHaveProperty('performance');
      expect(groups).toHaveProperty('request');
    });

    it('should exclude actions, status, and select columns from groups', () => {
      const groups = service.columnGroups();
      Object.values(groups).forEach((columns) => {
        expect(columns.find((c) => c.key === 'actions')).toBeUndefined();
        expect(columns.find((c) => c.key === ColumnKey.STATUS)).toBeUndefined();
        expect(columns.find((c) => c.key === ColumnKey.SELECT)).toBeUndefined();
      });
    });

    it('should group columns by their group property', () => {
      const groups = service.columnGroups();
      const allGroupedColumns = Object.values(groups).flat();
      const visibleColumns = service.visibleColumns();
      expect(allGroupedColumns.length).toBeGreaterThan(visibleColumns.length);
    });
  });

  describe('currentSort', () => {
    it('should return null initially', () => {
      expect(service.currentSort()).toBeNull();
    });

    it('should return sort config after updateSort is called', () => {
      service.updateSort(ColumnKey.TOTAL_REQUESTS, 'asc');
      expect(service.currentSort()).toEqual({
        columnKey: ColumnKey.TOTAL_REQUESTS,
        direction: 'asc',
      });
    });

    it('should return null after updateSort is called with null direction', () => {
      service.updateSort(ColumnKey.TOTAL_REQUESTS, 'asc');
      service.updateSort(ColumnKey.TOTAL_REQUESTS, null);
      expect(service.currentSort()).toBeNull();
    });
  });

  describe('updateSort', () => {
    it('should set sort config with columnKey and direction', () => {
      service.updateSort(ColumnKey.MIN_LATENCY, 'desc');
      expect(service.currentSort()).toEqual({
        columnKey: ColumnKey.MIN_LATENCY,
        direction: 'desc',
      });
    });

    it('should clear sort when direction is null', () => {
      service.updateSort(ColumnKey.MIN_LATENCY, 'desc');
      service.updateSort(ColumnKey.MIN_LATENCY, null);
      expect(service.currentSort()).toBeNull();
    });
  });

  describe('toggleSort', () => {
    it('should set sort to asc when column is not currently sorted', () => {
      service.toggleSort(ColumnKey.TOTAL_REQUESTS);
      expect(service.currentSort()).toEqual({
        columnKey: ColumnKey.TOTAL_REQUESTS,
        direction: 'asc',
      });
    });

    it('should toggle direction when same column is toggled', () => {
      service.toggleSort(ColumnKey.TOTAL_REQUESTS);
      service.toggleSort(ColumnKey.TOTAL_REQUESTS);
      expect(service.currentSort()).toEqual({
        columnKey: ColumnKey.TOTAL_REQUESTS,
        direction: 'desc',
      });
    });

    it('should set to asc when toggling a different column', () => {
      service.toggleSort(ColumnKey.TOTAL_REQUESTS);
      service.toggleSort(ColumnKey.MIN_LATENCY);
      expect(service.currentSort()).toEqual({
        columnKey: ColumnKey.MIN_LATENCY,
        direction: 'asc',
      });
    });
  });

  describe('getSortableColumns', () => {
    it('should return columns where sortable is not false', () => {
      const sortableColumns = service.getSortableColumns();
      sortableColumns.forEach((col) => {
        expect(col.sortable).not.toBe(false);
      });
    });

    it('should exclude non-sortable columns', () => {
      localStorageServiceMock.preferences = vi.fn().mockReturnValue({
        columnPreferences: [createDefaultColumn('test', { key: 'test', sortable: false })],
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TestListColumnsService,
          { provide: LocalStorageService, useValue: localStorageServiceMock },
          { provide: LogService, useValue: logServiceMock },
        ],
      });
      const newService = TestBed.inject(TestListColumnsService);
      const sortableColumns = newService.getSortableColumns();
      expect(sortableColumns.find((c) => c.key === 'test')).toBeUndefined();
    });
  });

  describe('reorderColumn', () => {
    it('should not reorder if dragged column is not draggable', () => {
      const visible = service.visibleColumns();
      const nonDraggable = visible.find((c) => !c.draggable);
      const draggable = visible.find((c) => c.draggable);

      if (nonDraggable && draggable) {
        const visibleBefore = service
          .visibleColumns()
          .map((c) => c.key)
          .join(',');
        service.reorderColumn(nonDraggable.key, draggable.key);
        const visibleAfter = service
          .visibleColumns()
          .map((c) => c.key)
          .join(',');
        expect(visibleBefore).toBe(visibleAfter);
      }
    });

    it('should not reorder if target column is not draggable', () => {
      const visible = service.visibleColumns();
      const draggable = visible.find((c) => c.draggable);
      const nonDraggable = visible.find((c) => !c.draggable);

      if (draggable && nonDraggable) {
        const visibleBefore = service
          .visibleColumns()
          .map((c) => c.key)
          .join(',');
        service.reorderColumn(draggable.key, nonDraggable.key);
        const visibleAfter = service
          .visibleColumns()
          .map((c) => c.key)
          .join(',');
        expect(visibleBefore).toBe(visibleAfter);
      }
    });

    it('should not reorder if dragged column not found', () => {
      const visible = service.visibleColumns();
      const draggable = visible.find((c) => c.draggable);

      if (draggable) {
        const visibleBefore = service
          .visibleColumns()
          .map((c) => c.key)
          .join(',');
        service.reorderColumn('nonexistent-key', draggable.key);
        const visibleAfter = service
          .visibleColumns()
          .map((c) => c.key)
          .join(',');
        expect(visibleBefore).toBe(visibleAfter);
      }
    });

    it('should not reorder if target column not found', () => {
      const visible = service.visibleColumns();
      const draggable = visible.find((c) => c.draggable);

      if (draggable) {
        const visibleBefore = service
          .visibleColumns()
          .map((c) => c.key)
          .join(',');
        service.reorderColumn(draggable.key, 'nonexistent-key');
        const visibleAfter = service
          .visibleColumns()
          .map((c) => c.key)
          .join(',');
        expect(visibleBefore).toBe(visibleAfter);
      }
    });
  });

  describe('updateColumnWidth', () => {
    it('should update column width', () => {
      const visible = service.visibleColumns();
      const column = visible.find((c) => c.width !== undefined);
      if (column) {
        service.updateColumnWidth(column.key, 200);
        const updated = service.visibleColumns();
        expect(updated.find((c) => c.key === column.key)?.width).toBe(200);
      }
    });

    it('should not throw for nonexistent column', () => {
      expect(() => service.updateColumnWidth('nonexistent', 100)).not.toThrow();
    });
  });

  describe('_loadColumnPreferences', () => {
    it('should merge saved columns with defaults', () => {
      const savedColumns: ColumnConfig[] = [
        {
          draggable: true,
          field: 'summary.global.totalRequests',
          format: 'number',
          group: 'request',
          key: ColumnKey.TOTAL_REQUESTS,
          label: 'Total',
          order: 99,
          sortable: true,
          visible: true,
        },
      ];
      localStorageServiceMock.preferences = vi.fn().mockReturnValue({
        columnPreferences: savedColumns,
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TestListColumnsService,
          { provide: LocalStorageService, useValue: localStorageServiceMock },
          { provide: LogService, useValue: logServiceMock },
        ],
      });
      const newService = TestBed.inject(TestListColumnsService);
      const totalRequestsCol = newService
        .columnGroups()
        ['request'].find((c) => c.key === ColumnKey.TOTAL_REQUESTS);
      expect(totalRequestsCol?.order).toBe(99);
    });

    it('should use default when no saved preferences', () => {
      localStorageServiceMock.preferences = vi.fn().mockReturnValue({
        columnPreferences: [],
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TestListColumnsService,
          { provide: LocalStorageService, useValue: localStorageServiceMock },
          { provide: LogService, useValue: logServiceMock },
        ],
      });
      const newService = TestBed.inject(TestListColumnsService);
      expect(newService.visibleColumns().length).toBeGreaterThan(0);
    });

    it('should log error when loading fails', () => {
      localStorageServiceMock.preferences = vi.fn().mockImplementation(() => {
        throw new Error('Storage error');
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TestListColumnsService,
          { provide: LocalStorageService, useValue: localStorageServiceMock },
          { provide: LogService, useValue: logServiceMock },
        ],
      });
      const newService = TestBed.inject(TestListColumnsService);
      expect(newService.visibleColumns().length).toBeGreaterThan(0);
      expect(logServiceMock.error).toHaveBeenCalled();
    });
  });

  describe('_saveColumnPreferences', () => {
    it('should call localStorageService.savePreferences', () => {
      service.toggleColumn(ColumnKey.TOTAL_REQUESTS);
      expect(localStorageServiceMock.savePreferences).toHaveBeenCalled();
    });

    it('should log error when saving fails', () => {
      localStorageServiceMock.savePreferences = vi.fn().mockImplementation(() => {
        throw new Error('Save error');
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TestListColumnsService,
          { provide: LocalStorageService, useValue: localStorageServiceMock },
          { provide: LogService, useValue: logServiceMock },
        ],
      });
      const newService = TestBed.inject(TestListColumnsService);
      expect(() => newService.toggleColumn(ColumnKey.TOTAL_REQUESTS)).not.toThrow();
    });
  });
});

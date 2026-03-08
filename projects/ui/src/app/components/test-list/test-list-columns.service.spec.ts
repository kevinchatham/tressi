import { TestBed } from '@angular/core/testing';
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
    expect(
      visible.find((c) => c.key === ColumnKey.TOTAL_REQUESTS)?.visible,
    ).toBe(true);
  });
});

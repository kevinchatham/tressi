import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventService } from '../../services/event.service';
import { LogService } from '../../services/log.service';
import { AppRouterService } from '../../services/router.service';
import { TestService } from '../../services/test.service';
import { TestListComponent } from './test-list.component';
import { TestListColumnsService } from './test-list-columns.service';
import { TestListDeleteService } from './test-list-delete.service';
import { TestListSelectionService } from './test-list-selection.service';

describe('TestListComponent', () => {
  let component: TestListComponent;
  let testServiceMock: { getTestsByConfigId: (...args: unknown[]) => unknown };
  let eventServiceMock: {
    getMetricsStream: (...args: unknown[]) => unknown;
    getTestEventsStream: (...args: unknown[]) => unknown;
  };

  beforeEach(() => {
    testServiceMock = { getTestsByConfigId: vi.fn().mockResolvedValue([]) };
    eventServiceMock = {
      getMetricsStream: vi.fn().mockReturnValue(of({ testSummary: {} })),
      getTestEventsStream: vi.fn().mockReturnValue(of({})),
    };

    TestBed.configureTestingModule({
      providers: [
        TestListComponent,
        { provide: TestService, useValue: testServiceMock },
        { provide: EventService, useValue: eventServiceMock },
        { provide: AppRouterService, useValue: {} },
        {
          provide: TestListColumnsService,
          useValue: {
            visibleColumns: vi.fn(),
            columnGroups: vi.fn(),
            currentSort: vi.fn(),
          },
        },
        {
          provide: TestListSelectionService,
          useValue: {
            selectedTestsSet: vi.fn(),
            getSelectedCount: vi.fn(),
            isAllSelected: vi.fn(),
            isSomeSelected: vi.fn(),
            hasRunningTestsSelected: vi.fn(),
            clearSelection: vi.fn(),
          },
        },
        { provide: TestListDeleteService, useValue: {} },
        { provide: LogService, useValue: { error: vi.fn() } },
      ],
    });
    component = TestBed.inject(TestListComponent);
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});

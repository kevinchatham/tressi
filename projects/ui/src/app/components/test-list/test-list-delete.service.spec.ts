import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogService } from '../../services/log.service';
import { TestService } from '../../services/test.service';
import { TestListDeleteService } from './test-list-delete.service';

describe('TestListDeleteService', () => {
  let service: TestListDeleteService;
  let testServiceMock: { deleteTest: (...args: unknown[]) => unknown };
  let logServiceMock: {
    info: (...args: unknown[]) => unknown;
    error: (...args: unknown[]) => unknown;
  };

  beforeEach(() => {
    testServiceMock = {
      deleteTest: vi.fn(),
    };
    logServiceMock = {
      info: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TestListDeleteService,
        { provide: TestService, useValue: testServiceMock },
        { provide: LogService, useValue: logServiceMock },
      ],
    });
    service = TestBed.inject(TestListDeleteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should delete a single test successfully', async () => {
    (
      testServiceMock.deleteTest as unknown as {
        mockResolvedValue: (val: unknown) => void;
      }
    ).mockResolvedValue({ success: true });
    const result = await service.deleteTest('test-1');
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(1);
  });

  it('should handle deletion failure', async () => {
    (
      testServiceMock.deleteTest as unknown as {
        mockResolvedValue: (val: unknown) => void;
      }
    ).mockResolvedValue({ success: false });
    const result = await service.deleteTest('test-1');
    expect(result.success).toBe(false);
    expect(result.failedCount).toBe(1);
  });
});

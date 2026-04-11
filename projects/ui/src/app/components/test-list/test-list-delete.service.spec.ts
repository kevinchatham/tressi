import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogService } from '../../services/log.service';
import { TestService } from '../../services/test.service';
import { TestListDeleteService } from './test-list-delete.service';

describe('TestListDeleteService', () => {
  let service: TestListDeleteService;
  let testServiceMock: ReturnType<typeof vi.fn>;
  let logServiceMock: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    testServiceMock = vi.fn();
    logServiceMock = {
      error: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TestListDeleteService,
        { provide: TestService, useValue: { deleteTest: testServiceMock } },
        { provide: LogService, useValue: logServiceMock },
      ],
    });
    service = TestBed.inject(TestListDeleteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should delete a single test successfully', async () => {
    (testServiceMock as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    const result = await service.deleteTest('test-1');
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(1);
  });

  it('should handle deletion failure', async () => {
    (testServiceMock as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });
    const result = await service.deleteTest('test-1');
    expect(result.success).toBe(false);
    expect(result.failedCount).toBe(1);
  });

  it('should handle deletion exception', async () => {
    (testServiceMock as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const result = await service.deleteTest('test-1');
    expect(result.success).toBe(false);
    expect(result.failedCount).toBe(1);
    expect(result.errors[0]).toBe('Network error');
    expect(logServiceMock.error).toHaveBeenCalled();
  });

  describe('deleteTests', () => {
    it('should return success with zero counts for empty array', async () => {
      const result = await service.deleteTests([]);
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should delete all tests successfully', async () => {
      (testServiceMock as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      const result = await service.deleteTests(['test-1', 'test-2', 'test-3']);
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(logServiceMock.info).toHaveBeenCalledWith('3 tests deleted successfully');
    });

    it('should handle partial failures', async () => {
      (testServiceMock as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: true });
      const result = await service.deleteTests(['test-1', 'test-2', 'test-3']);
      expect(result.success).toBe(false);
      expect(result.deletedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toContain('Test test-1: Deletion failed');
    });

    it('should handle all failures', async () => {
      (testServiceMock as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });
      const result = await service.deleteTests(['test-1', 'test-2']);
      expect(result.success).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.failedCount).toBe(2);
    });

    it('should handle rejected promises', async () => {
      (testServiceMock as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({ success: true });
      const result = await service.deleteTests(['test-1', 'test-2']);
      expect(result.success).toBe(false);
      expect(result.deletedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toContain('Test test-1: Error: Server error');
    });
  });

  describe('deleteTestWithLoading', () => {
    it('should delete test with loading state', async () => {
      (testServiceMock as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      const result = await service.deleteTestWithLoading('test-1');
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
    });
  });

  describe('deleteTestsWithLoading', () => {
    it('should delete multiple tests with loading state', async () => {
      (testServiceMock as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      const result = await service.deleteTestsWithLoading(['test-1', 'test-2']);
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LogService } from './log.service';
import { RPCService } from './rpc.service';
import { TestExportService } from './test-export.service';

describe('TestExportService', () => {
  let service: TestExportService;
  let mockRPC: { client: { tests: { ':id': { export: { $get: Mock } } } } };
  let mockLog: { info: Mock; error: Mock };

  beforeEach(() => {
    mockRPC = {
      client: {
        tests: {
          ':id': {
            export: { $get: vi.fn() },
          },
        },
      },
    } as unknown as {
      client: { tests: { ':id': { export: { $get: Mock } } } };
    };

    mockLog = { error: vi.fn(), info: vi.fn() };

    // Mock URL methods
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:url'),
      revokeObjectURL: vi.fn(),
    });

    // Mock document.createElement for download link
    const mockAnchor = {
      click: vi.fn(),
      download: '',
      href: '',
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => ({}) as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => ({}) as unknown as Node);

    TestBed.configureTestingModule({
      providers: [
        TestExportService,
        { provide: RPCService, useValue: mockRPC },
        { provide: LogService, useValue: mockLog },
      ],
    });

    service = TestBed.inject(TestExportService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('exportTest', () => {
    it('should successfully export a test in JSON format', async () => {
      const mockBlob = new Blob(['{}'], { type: 'application/json' });
      mockRPC.client.tests[':id'].export.$get.mockResolvedValue({
        blob: async () => mockBlob,
        ok: true,
      });

      await service.exportTest('test-123', 'json');

      expect(mockRPC.client.tests[':id'].export.$get).toHaveBeenCalledWith({
        param: { id: 'test-123' },
        query: { format: 'json' },
      });
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLog.info).toHaveBeenCalledWith('Test exported successfully', {
        format: 'json',
        testId: 'test-123',
      });
    });

    it('should log and throw error when export fails', async () => {
      mockRPC.client.tests[':id'].export.$get.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.exportTest('invalid', 'xlsx')).rejects.toThrow(
        'Export failed: Not Found',
      );
      expect(mockLog.error).toHaveBeenCalled();
    });
  });
});

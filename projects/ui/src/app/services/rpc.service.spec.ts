import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RPCService } from './rpc.service';

describe('RPCService', () => {
  let service: RPCService;
  let mockClient: unknown;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [RPCService],
    });
    service = TestBed.inject(RPCService);
    mockClient = service.client;
  });

  describe('getTestStatus', () => {
    it('should return not running status', async () => {
      (
        (mockClient as { test: { status: { $get: Mock } } }).test.status.$get as Mock
      ).mockResolvedValue({
        json: async () => ({ isRunning: false }),
        ok: true,
      });

      const status = await service.getTestStatus();

      expect(status).toEqual({ isRunning: false });
    });

    it('should return not running status on API error', async () => {
      (
        (mockClient as { test: { status: { $get: Mock } } }).test.status.$get as Mock
      ).mockResolvedValue({
        ok: false,
        statusText: 'Error',
      });

      const status = await service.getTestStatus();

      expect(status).toEqual({ isRunning: false });
    });

    it('should return not running status on network error', async () => {
      (
        (mockClient as { test: { status: { $get: Mock } } }).test.status.$get as Mock
      ).mockRejectedValue(new Error('Network Error'));

      const status = await service.getTestStatus();

      expect(status).toEqual({ isRunning: false });
    });
  });
});

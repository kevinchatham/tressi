import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartSyncService } from './chart-sync.service';

describe('ChartSyncService', () => {
  let service: ChartSyncService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [ChartSyncService],
    });
    service = TestBed.inject(ChartSyncService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const state = service.getState();
    expect(state.xAxisMin).toBeNull();
    expect(state.xAxisMax).toBeNull();
    expect(state.lastInteractedChartId).toBeNull();
  });

  describe('registerChart', () => {
    it('should allow setting a registered chart as master', () => {
      service.registerChart('chart-1');
      service.setAsMaster('chart-1');
      expect(service.lastInteractedChartId()).toBe('chart-1');
    });

    it('should not set an unregistered chart as master', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      service.setAsMaster('unregistered-chart');
      expect(service.lastInteractedChartId()).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('Chart unregistered-chart not registered');
      warnSpy.mockRestore();
    });
  });

  describe('broadcastState', () => {
    it('should update state when broadcasted', () => {
      service.broadcastState({ xAxisMax: 200, xAxisMin: 100 });
      expect(service.getState().xAxisMin).toBe(100);
      expect(service.getState().xAxisMax).toBe(200);
    });

    it('should throttle updates based on batchMs', () => {
      // First update should go through
      service.broadcastState({ xAxisMin: 100 });
      expect(service.getState().xAxisMin).toBe(100);

      // Second update within 16ms should be ignored
      vi.advanceTimersByTime(10);
      service.broadcastState({ xAxisMin: 200 });
      expect(service.getState().xAxisMin).toBe(100); // Still 100

      // Third update after 16ms should go through
      vi.advanceTimersByTime(10); // Total 20ms
      service.broadcastState({ xAxisMin: 300 });
      expect(service.getState().xAxisMin).toBe(300);
    });
  });
});

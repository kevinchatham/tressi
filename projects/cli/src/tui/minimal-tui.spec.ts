import { performance } from 'node:perf_hooks';
import type { TressiConfig } from '@tressi/shared/common';
import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Runner } from '../core/runner';
import { MinimalTUI } from './minimal-tui';

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(),
    succeed: vi.fn(),
    text: '',
  })),
}));

vi.mock('perf_hooks', () => ({
  performance: {
    now: vi.fn(),
  },
}));

describe('MinimalTUI', () => {
  let config: TressiConfig;
  let runner: Runner;

  beforeEach(() => {
    config = { options: { durationSec: 10 } } as unknown as TressiConfig;
    runner = {
      getAggregatedMetrics: vi.fn(() => ({
        cpuUsagePercent: 10,
        global: {
          averageRequestsPerSecond: 50,
          p50LatencyMs: 10,
        },
        memoryUsageMB: 100,
      })),
      getStartTime: vi.fn(() => 1000),
    } as unknown as Runner;
    vi.clearAllMocks();
    vi.mocked(performance.now).mockReturnValue(2000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start the spinner', () => {
    const tui = new MinimalTUI(config, false);
    tui.start(runner);
    expect(ora).toHaveBeenCalled();
  });

  it('should stop the spinner', () => {
    const tui = new MinimalTUI(config, false);
    tui.start(runner);
    tui.stop();
    // We need to access the mocked spinner instance
    const mockOra = vi.mocked(ora);
    const spinnerInstance = mockOra.mock.results[0].value;
    expect(spinnerInstance.succeed).toHaveBeenCalled();
  });

  it('should update display', () => {
    const tui = new MinimalTUI(config, false);
    tui.start(runner);
    // Trigger the interval manually if possible, or call private method
    (tui as unknown as { _updateDisplay: (runner: Runner) => void })._updateDisplay(runner);
    const mockOra = vi.mocked(ora);
    const spinnerInstance = mockOra.mock.results[0].value;
    expect(spinnerInstance.text).toContain('50 rps');
  });

  it('should not start spinner when silent is true', () => {
    const tui = new MinimalTUI(config, true);
    tui.start(runner);
    // When silent, ora should still be called (constructor always calls it)
    // but start() should not be called
    const mockOra = vi.mocked(ora);
    const spinnerInstance = mockOra.mock.results[0].value;
    expect(spinnerInstance.start).not.toHaveBeenCalled();
  });

  it('should not stop spinner when silent is true', () => {
    const tui = new MinimalTUI(config, true);
    tui.start(runner);
    tui.stop();
    const mockOra = vi.mocked(ora);
    const spinnerInstance = mockOra.mock.results[0].value;
    expect(spinnerInstance.succeed).not.toHaveBeenCalled();
  });
});

import { TressiConfig } from '@tressi/shared/common';
import ora from 'ora';
import { performance } from 'perf_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Runner } from '../core/runner';
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
      getStartTime: vi.fn(() => 1000),
      getAggregatedMetrics: vi.fn(() => ({
        memoryUsageMB: 100,
        cpuUsagePercent: 10,
        global: {
          averageRequestsPerSecond: 50,
          p50LatencyMs: 10,
        },
      })),
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
    (
      tui as unknown as { _updateDisplay: (runner: Runner) => void }
    )._updateDisplay(runner);
    const mockOra = vi.mocked(ora);
    const spinnerInstance = mockOra.mock.results[0].value;
    expect(spinnerInstance.text).toContain('50 rps');
  });
});

import type { TestSummary, TressiConfig, TressiOptionsConfig } from '@tressi/shared/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printSummary } from './cli-output';
import { terminal } from './terminal';

vi.mock('./terminal', () => ({
  terminal: {
    print: vi.fn(),
  },
}));

describe('cli-output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not print anything if silent is true', () => {
    const summary = {} as unknown as TestSummary;
    const options = {} as unknown as TressiOptionsConfig;
    const config = {} as unknown as TressiConfig;
    printSummary(summary, options, config, true);
    expect(terminal.print).not.toHaveBeenCalled();
  });

  it('should print summary when silent is false', () => {
    const summary = {
      endpoints: [
        {
          failedRequests: 0,
          maxLatencyMs: 10,
          minLatencyMs: 1,
          p50LatencyMs: 5,
          p95LatencyMs: 8,
          p99LatencyMs: 9,
          successfulRequests: 50,
          url: '/test',
        },
      ],
      global: {
        failedRequests: 10,
        finalDurationSec: 10,
        maxLatencyMs: 50,
        minLatencyMs: 1,
        p50LatencyMs: 5,
        p95LatencyMs: 10,
        p99LatencyMs: 20,
        successfulRequests: 90,
        totalRequests: 100,
      },
      tressiVersion: '1.0.0',
    } as unknown as TestSummary;
    const options = { durationSec: 10 } as unknown as TressiOptionsConfig;
    const config = { requests: [{ rps: 10 }] } as unknown as TressiConfig;

    printSummary(summary, options, config, false);
    expect(terminal.print).toHaveBeenCalled();
  });
});

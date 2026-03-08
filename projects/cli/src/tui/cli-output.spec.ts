import {
  TestSummary,
  TressiConfig,
  TressiOptionsConfig,
} from '@tressi/shared/common';
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
      tressiVersion: '1.0.0',
      global: {
        finalDurationSec: 10,
        totalRequests: 100,
        successfulRequests: 90,
        failedRequests: 10,
        minLatencyMs: 1,
        p50LatencyMs: 5,
        p95LatencyMs: 10,
        p99LatencyMs: 20,
        maxLatencyMs: 50,
      },
      endpoints: [
        {
          url: '/test',
          successfulRequests: 50,
          failedRequests: 0,
          p50LatencyMs: 5,
          minLatencyMs: 1,
          maxLatencyMs: 10,
          p95LatencyMs: 8,
          p99LatencyMs: 9,
        },
      ],
    } as unknown as TestSummary;
    const options = { durationSec: 10 } as unknown as TressiOptionsConfig;
    const config = { requests: [{ rps: 10 }] } as unknown as TressiConfig;

    printSummary(summary, options, config, false);
    expect(terminal.print).toHaveBeenCalled();
  });
});

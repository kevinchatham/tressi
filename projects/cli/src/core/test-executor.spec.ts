import type { TestSummary, TressiConfig } from '@tressi/shared/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Runner } from './runner';
import * as testExecutor from './test-executor';

vi.mock('./runner');
vi.mock('../tui/minimal-tui');
vi.mock('../reporting/exporters/json-exporter');
vi.mock('../reporting/exporters/markdown-exporter');
vi.mock('../reporting/exporters/xlsx-exporter');
vi.mock('../tui/cli-output');
vi.mock('../utils/file-utils');

describe('test-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run load test successfully', async () => {
    const mockConfig = {
      options: { workerEarlyExit: { enabled: false } },
      requests: [],
    } as unknown as TressiConfig;

    const runnerMock = vi.mocked(Runner.prototype);
    runnerMock.getTestSummary.mockReturnValue({
      configSnapshot: mockConfig,
      endpoints: [],
    } as unknown as TestSummary);
    runnerMock.isCanceled.mockReturnValue(false);

    const result = await testExecutor.runLoadTest(mockConfig, undefined, true);

    expect(runnerMock.run).toHaveBeenCalled();
    expect(result.summary).toBeDefined();
    expect(result.isCanceled).toBe(false);
  });

  it('should handle test cancellation', async () => {
    const mockConfig = {
      options: { workerEarlyExit: { enabled: false } },
      requests: [],
    } as unknown as TressiConfig;

    const runnerMock = vi.mocked(Runner.prototype);
    runnerMock.getTestSummary.mockReturnValue({
      configSnapshot: mockConfig,
      endpoints: [],
    } as unknown as TestSummary);
    runnerMock.isCanceled.mockReturnValue(true);

    const result = await testExecutor.runLoadTest(mockConfig, undefined, true);

    expect(result.isCanceled).toBe(true);
  });

  it('should stop the load test', async () => {
    const mockConfig = { options: {} } as unknown as TressiConfig;

    // Start a test in background
    testExecutor.runLoadTest(mockConfig, undefined, true);

    await testExecutor.stopLoadTest();

    const runnerMock = vi.mocked(Runner.prototype);
    expect(runnerMock.cancel).toHaveBeenCalled();
  });
});

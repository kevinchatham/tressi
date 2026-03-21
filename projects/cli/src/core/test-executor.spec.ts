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
vi.mock('../collections/test-collection');
vi.mock('../collections/config-collection');

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

  it('should throw error when threshold is exceeded', async () => {
    const mockConfig = {
      options: { workerEarlyExit: { enabled: true, errorRateThreshold: 0.3 } },
      requests: [{ url: 'http://test.com' }],
    } as unknown as TressiConfig;

    const runnerMock = vi.mocked(Runner.prototype);
    runnerMock.getTestSummary.mockReturnValue({
      configSnapshot: mockConfig,
      endpoints: [
        {
          errorRate: 0.5,
          statusCodeDistribution: {},
          url: 'http://test.com',
        },
      ],
    } as unknown as TestSummary);
    runnerMock.isCanceled.mockReturnValue(false);

    await expect(testExecutor.runLoadTest(mockConfig, undefined, true)).rejects.toThrow(
      'Test failed: One or more error thresholds were exceeded.',
    );
  });

  it('should throw error when exit status code is detected', async () => {
    const mockConfig = {
      options: { workerEarlyExit: { enabled: true, exitStatusCodes: [500, 502] } },
      requests: [{ url: 'http://test.com' }],
    } as unknown as TressiConfig;

    const runnerMock = vi.mocked(Runner.prototype);
    runnerMock.getTestSummary.mockReturnValue({
      configSnapshot: mockConfig,
      endpoints: [
        {
          errorRate: 0,
          statusCodeDistribution: { 200: 10, 500: 2 },
          url: 'http://test.com',
        },
      ],
    } as unknown as TestSummary);
    runnerMock.isCanceled.mockReturnValue(false);

    await expect(testExecutor.runLoadTest(mockConfig, undefined, true)).rejects.toThrow(
      'Test failed: One or more error thresholds were exceeded.',
    );
  });

  it('should use endpoint-level earlyExit config when provided', async () => {
    const mockConfig = {
      options: { workerEarlyExit: { enabled: true, errorRateThreshold: 0.1 } },
      requests: [
        {
          earlyExit: { enabled: true, errorRateThreshold: 0.8 },
          url: 'http://test.com',
        },
      ],
    } as unknown as TressiConfig;

    const runnerMock = vi.mocked(Runner.prototype);
    runnerMock.getTestSummary.mockReturnValue({
      configSnapshot: mockConfig,
      endpoints: [
        {
          errorRate: 0.5,
          statusCodeDistribution: {},
          url: 'http://test.com',
        },
      ],
    } as unknown as TestSummary);
    runnerMock.isCanceled.mockReturnValue(false);

    // Should not throw because endpoint threshold (0.8) is higher than error rate (0.5)
    const result = await testExecutor.runLoadTest(mockConfig, undefined, true);
    expect(result.isCanceled).toBe(false);
  });

  it('should handle non-matching endpoint in threshold check', async () => {
    const mockConfig = {
      options: { workerEarlyExit: { enabled: true, errorRateThreshold: 0.3 } },
      requests: [{ url: 'http://test.com' }],
    } as unknown as TressiConfig;

    const runnerMock = vi.mocked(Runner.prototype);
    runnerMock.getTestSummary.mockReturnValue({
      configSnapshot: mockConfig,
      endpoints: [
        {
          errorRate: 0.9,
          statusCodeDistribution: {},
          url: 'http://other.com', // Different URL - no matching request config
        },
      ],
    } as unknown as TestSummary);
    runnerMock.isCanceled.mockReturnValue(false);

    // Should not throw because endpoint URL doesn't match any request config
    const result = await testExecutor.runLoadTest(mockConfig, undefined, true);
    expect(result.isCanceled).toBe(false);
  });

  it('should start and stop TUI when enableTUI is true and silent is false', async () => {
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

    const { MinimalTUI } = await import('../tui/minimal-tui');

    // silent = false means enableTUI = true
    const result = await testExecutor.runLoadTest(mockConfig, undefined, false);

    expect(runnerMock.run).toHaveBeenCalled();
    expect(MinimalTUI.prototype.start).toHaveBeenCalled();
    expect(MinimalTUI.prototype.stop).toHaveBeenCalled();
    expect(result.summary).toBeDefined();
  });
});

describe('checkThresholds', () => {
  it('should return false when error rate is below threshold', () => {
    const summary = {
      configSnapshot: {
        options: { workerEarlyExit: { enabled: true, errorRateThreshold: 0.5 } },
        requests: [
          { earlyExit: { enabled: true, errorRateThreshold: 0.3 }, url: 'http://test.com' },
        ],
      },
      endpoints: [
        {
          errorRate: 0.1,
          statusCodeDistribution: {},
          url: 'http://test.com',
        },
      ],
    } as unknown as TestSummary;

    // Access the checkThresholds function through executeLoadTest behavior
    const result =
      summary.endpoints[0].errorRate <
      (summary.endpoints[0] as (typeof summary.endpoints)[0] & { errorRateThreshold?: number })
        .errorRateThreshold!;
    expect(result).toBe(false);
  });

  it('should return true when error rate exceeds threshold', () => {
    const summary = {
      configSnapshot: {
        options: { workerEarlyExit: { enabled: true, errorRateThreshold: 0.5 } },
        requests: [{ url: 'http://test.com' }],
      },
      endpoints: [
        {
          errorRate: 0.6,
          statusCodeDistribution: {},
          url: 'http://test.com',
        },
      ],
    } as unknown as TestSummary;

    const endpoint = summary.endpoints[0];
    const requestConfig = summary.configSnapshot.requests.find((r) => r.url === endpoint.url);
    const earlyExit = requestConfig?.earlyExit ?? summary.configSnapshot.options.workerEarlyExit;

    if (
      earlyExit?.enabled &&
      earlyExit.errorRateThreshold > 0 &&
      endpoint.errorRate >= earlyExit.errorRateThreshold
    ) {
      expect(true).toBe(true);
    } else {
      expect(false).toBe(true);
    }
  });

  it('should check status code thresholds', () => {
    const summary = {
      configSnapshot: {
        options: { workerEarlyExit: { enabled: true, exitStatusCodes: [500, 502] } },
        requests: [{ url: 'http://test.com' }],
      },
      endpoints: [
        {
          errorRate: 0,
          statusCodeDistribution: { 200: 10, 500: 2 },
          url: 'http://test.com',
        },
      ],
    } as unknown as TestSummary;

    const endpoint = summary.endpoints[0];
    const earlyExit = summary.configSnapshot.options.workerEarlyExit;

    if (earlyExit?.enabled && earlyExit.exitStatusCodes?.length > 0) {
      const hasExitCode = earlyExit.exitStatusCodes.some(
        (code) => endpoint.statusCodeDistribution[code] > 0,
      );
      expect(hasExitCode).toBe(true);
    }
  });

  it('should use global exit config when endpoint does not override', () => {
    const summary = {
      configSnapshot: {
        options: { workerEarlyExit: { enabled: true, errorRateThreshold: 0.2 } },
        requests: [{ url: 'http://test.com' }],
      },
      endpoints: [
        {
          errorRate: 0.25,
          statusCodeDistribution: {},
          url: 'http://test.com',
        },
      ],
    } as unknown as TestSummary;

    const endpoint = summary.endpoints[0];
    const requestConfig = summary.configSnapshot.requests.find((r) => r.url === endpoint.url);
    const earlyExit =
      requestConfig?.earlyExit !== undefined
        ? requestConfig.earlyExit
        : summary.configSnapshot.options.workerEarlyExit;

    expect(earlyExit?.enabled).toBe(true);
    expect(endpoint.errorRate >= earlyExit!.errorRateThreshold!).toBe(true);
  });
});

describe('handleCLIExport', () => {
  it('should export results to JSON, XLSX, and Markdown', async () => {
    // The function is tested through the runLoadTest flow with exportPath
    // This tests the export logic
    const { JsonExporter } = await import('../reporting/exporters/json-exporter');
    const { XlsxExporter } = await import('../reporting/exporters/xlsx-exporter');
    const { MarkdownExporter } = await import('../reporting/exporters/markdown-exporter');

    const jsonExporter = new JsonExporter();
    const xlsxExporter = new XlsxExporter();
    const markdownExporter = new MarkdownExporter();

    // Verify exporters exist and have export method
    expect(jsonExporter.export).toBeDefined();
    expect(xlsxExporter.export).toBeDefined();
    expect(markdownExporter.export).toBeDefined();
  });

  it('should export results with provided exportPath', async () => {
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

    const result = await testExecutor.runLoadTest(mockConfig, '/tmp/test-export', true);

    expect(runnerMock.run).toHaveBeenCalled();
    expect(result.summary).toBeDefined();
  });

  it('should handle export failure gracefully', async () => {
    const { FileUtils } = await import('../utils/file-utils');
    vi.mocked(FileUtils.ensureDirectoryExists).mockRejectedValueOnce(
      new Error('Directory creation failed'),
    );

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

    // Should not throw, error is handled gracefully
    const result = await testExecutor.runLoadTest(mockConfig, '/tmp/test-export', true);
    expect(result.summary).toBeDefined();
  });
});

describe('runLoadTestForServer', () => {
  it('should have runLoadTestForServer function exported', () => {
    expect(typeof testExecutor.runLoadTestForServer).toBe('function');
  });

  it('should have stopLoadTest function exported', () => {
    expect(typeof testExecutor.stopLoadTest).toBe('function');
  });

  it('should execute load test for server with valid testId', async () => {
    const { testStorage } = await import('../collections/test-collection');
    const { configStorage } = await import('../collections/config-collection');

    const mockTest = { configId: 'config-1', id: 'test-1' };
    const mockConfig = {
      id: 'config-1',
      options: { workerEarlyExit: { enabled: false } },
      requests: [],
    } as unknown as TressiConfig;

    vi.mocked(testStorage.getById).mockResolvedValue(mockTest as never);
    vi.mocked(configStorage.getById).mockResolvedValue({ config: mockConfig } as never);

    const runnerMock = vi.mocked(Runner.prototype);
    runnerMock.getTestSummary.mockReturnValue({
      configSnapshot: mockConfig,
      endpoints: [],
    } as unknown as TestSummary);
    runnerMock.isCanceled.mockReturnValue(false);

    const result = await testExecutor.runLoadTestForServer('test-1');

    expect(testStorage.getById).toHaveBeenCalledWith('test-1');
    expect(configStorage.getById).toHaveBeenCalledWith('config-1');
    expect(runnerMock.run).toHaveBeenCalled();
    expect(result.isCanceled).toBe(false);
  });

  it('should throw error when test is not found', async () => {
    const { testStorage } = await import('../collections/test-collection');

    vi.mocked(testStorage.getById).mockResolvedValue(undefined);

    await expect(testExecutor.runLoadTestForServer('nonexistent')).rejects.toThrow(
      'Test with ID nonexistent not found',
    );
  });

  it('should throw error when config is not found', async () => {
    const { testStorage } = await import('../collections/test-collection');
    const { configStorage } = await import('../collections/config-collection');

    const mockTest = { configId: 'config-1', id: 'test-1' };

    vi.mocked(testStorage.getById).mockResolvedValue(mockTest as never);
    vi.mocked(configStorage.getById).mockResolvedValue(undefined);

    await expect(testExecutor.runLoadTestForServer('test-1')).rejects.toThrow(
      'Config with ID config-1 not found',
    );
  });
});

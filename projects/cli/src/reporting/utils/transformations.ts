import type { EndpointSummary, TestSummary } from '@tressi/shared/common';

export function transformAggregatedMetricToTestSummary(snapshots: TestSummary[]): TestSummary {
  if (!snapshots || snapshots.length === 0) {
    throw new Error('Cannot generate test summary without snapshots');
  }

  // The last snapshot contains the final cumulative totals and latencies
  const lastSnapshot = snapshots[snapshots.length - 1];

  // Shallow clone the top level and global/endpoints arrays to avoid mutating the snapshot
  // while avoiding the overhead of structuredClone on every poll.
  const finalSummary: TestSummary = {
    ...lastSnapshot,
    endpoints: lastSnapshot.endpoints.map((e) => ({ ...e })),
    global: { ...lastSnapshot.global },
  };

  // Calculate final global aggregates
  const totalDurationSec = lastSnapshot.global.finalDurationSec;

  finalSummary.global.averageRequestsPerSecond =
    totalDurationSec > 0 ? lastSnapshot.global.totalRequests / totalDurationSec : 0;

  finalSummary.global.peakRequestsPerSecond = Math.max(
    ...snapshots.map((s) => s.global.averageRequestsPerSecond),
  );

  const cpuSum = snapshots.reduce((sum, s) => sum + s.global.avgSystemCpuUsagePercent, 0);
  finalSummary.global.avgSystemCpuUsagePercent =
    snapshots.length > 0 ? cpuSum / snapshots.length : 0;

  const memorySum = snapshots.reduce((sum, s) => sum + s.global.avgProcessMemoryUsageMB, 0);
  finalSummary.global.avgProcessMemoryUsageMB =
    snapshots.length > 0 ? memorySum / snapshots.length : 0;

  // Calculate global target achieved based on peak RPS
  if (finalSummary.configSnapshot && finalSummary.configSnapshot.requests.length > 0) {
    const totalTargetRps = finalSummary.configSnapshot.requests.reduce(
      (sum, req) => sum + req.rps,
      0,
    );
    if (totalTargetRps > 0) {
      finalSummary.global.targetAchieved =
        finalSummary.global.peakRequestsPerSecond / totalTargetRps;
    }
  }

  // Calculate final endpoint aggregates
  finalSummary.endpoints.forEach((endpoint) => {
    const endpointSnapshots = snapshots
      .map((s) => s.endpoints.find((e) => e.url === endpoint.url))
      .filter(Boolean) as EndpointSummary[];

    endpoint.averageRequestsPerSecond =
      totalDurationSec > 0 ? endpoint.totalRequests / totalDurationSec : 0;

    endpoint.peakRequestsPerSecond = Math.max(
      ...endpointSnapshots.map((e) => e.averageRequestsPerSecond),
    );

    if (finalSummary.configSnapshot) {
      const requestConfig = finalSummary.configSnapshot.requests.find(
        (req) => req.url === endpoint.url,
      );
      if (requestConfig && requestConfig.rps > 0) {
        endpoint.targetAchieved = endpoint.peakRequestsPerSecond / requestConfig.rps;
      }
    }
  });

  return finalSummary;
}

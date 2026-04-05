import type { EndpointSummary, TestSummary } from '@tressi/shared/common';

/**
 * Calculates the effective ramp-up duration for an endpoint.
 * If the endpoint has its own ramp-up (rampUpDurationSec > 0), use that.
 * Otherwise, use the global ramp-up.
 */
function getEffectiveRampUpSec(endpointRampUp: number | undefined, globalRampUp: number): number {
  return endpointRampUp !== undefined && endpointRampUp > 0 ? endpointRampUp : globalRampUp;
}

/**
 * Transforms an array of periodic snapshots into a single final {@link TestSummary}.
 *
 * **Time-window notes**
 * - `global.averageRequestsPerSecond` subtracts the maximum effective ramp-up from the
 *   denominator so it represents sustained throughput during the steady-state window only.
 * - `endpoint.averageRequestsPerSecond` subtracts the effective ramp-up from the denominator
 *   so it represents sustained throughput during the steady-state window only.
 * These two values use the same steady-state logic and will sum to the global figure if all
 * endpoints share the same ramp-up.
 *
 * **targetAchieved** is computed from `averageRequestsPerSecond` (not peak) so it reflects
 * whether the target RPS was sustained over the steady-state period, not merely touched
 * momentarily.
 */
export function transformAggregatedMetricsToTestSummary(snapshots: TestSummary[]): TestSummary {
  if (!snapshots || snapshots.length === 0) {
    throw new Error('Cannot generate test summary without snapshots');
  }

  // The last snapshot contains the final cumulative totals and latencies
  const lastSnapshot = snapshots.at(-1)!;

  // Shallow clone the top level and global/endpoints arrays to avoid mutating the snapshot
  // while avoiding the overhead of structuredClone on every poll.
  // NOTE: nested objects such as `statusCodeDistribution` on each endpoint are NOT deep-cloned;
  // callers must not mutate those objects on the returned summary.
  const finalSummary: TestSummary = {
    ...lastSnapshot,
    endpoints: lastSnapshot.endpoints.map((e) => ({ ...e })),
    global: { ...lastSnapshot.global },
  };

  // Calculate final global aggregates
  const totalDurationSec = lastSnapshot.global.finalDurationSec;

  // Get test start time from the first snapshot
  const testStartTime = snapshots[0].global.epochStartedAt;

  // Get global ramp-up from config
  const globalRampUpSec = finalSummary.configSnapshot?.options?.rampUpDurationSec ?? 0;

  // Calculate max endpoint ramp-up (test isn't steady-state until slowest endpoint finishes ramping).
  // The reduce is seeded with `globalRampUpSec` so that it acts as a floor: even if every
  // request config has a shorter (or zero) ramp-up, the global ramp-up is always respected.
  // An empty `requests` array returns the seed directly, which is the correct fallback.
  const maxEndpointRampUpSec =
    finalSummary.configSnapshot?.requests?.reduce((max, req) => {
      const effective = getEffectiveRampUpSec(req.rampUpDurationSec, globalRampUpSec);
      return Math.max(max, effective);
    }, globalRampUpSec) ?? globalRampUpSec;

  // Calculate global steady-state start time (test start + max ramp-up)
  const globalSteadyStateTime = testStartTime + maxEndpointRampUpSec * 1000;

  // Filter snapshots to exclude ramp-up period
  const steadyStateSnapshots = snapshots.filter(
    (s) => s.global.epochEndedAt >= globalSteadyStateTime,
  );

  // Compute a steady-state average RPS for global throughput and targetAchieved so that a long
  // ramp-up does not dilute the reported performance.
  // We calculate the delta between the first and last steady-state snapshots to ensure
  // we only count requests that occurred during the steady-state window.
  if (steadyStateSnapshots.length > 1) {
    const firstSteady = steadyStateSnapshots[0];
    const lastSteady = steadyStateSnapshots.at(-1)!;
    const steadyRequests = lastSteady.global.totalRequests - firstSteady.global.totalRequests;
    const steadyDurationMs = lastSteady.global.epochEndedAt - firstSteady.global.epochEndedAt;
    const steadyDurationSec = steadyDurationMs / 1000;

    finalSummary.global.averageRequestsPerSecond =
      steadyDurationSec > 0 ? steadyRequests / steadyDurationSec : 0;
  } else {
    // Fallback: if the ramp-up consumed the entire test or we have insufficient snapshots,
    // use the full duration and total requests so the result is still meaningful.
    // NOTE: This fallback still uses total requests / total duration, which is the legacy behavior
    // for single-snapshot or ramp-up-only tests.
    const globalActiveDurationSec =
      totalDurationSec > maxEndpointRampUpSec
        ? totalDurationSec - maxEndpointRampUpSec
        : totalDurationSec;

    finalSummary.global.averageRequestsPerSecond =
      globalActiveDurationSec > 0 ? lastSnapshot.global.totalRequests / globalActiveDurationSec : 0;
  }

  if (steadyStateSnapshots.length > 0) {
    finalSummary.global.peakRequestsPerSecond = Math.max(
      ...steadyStateSnapshots.map((s) => s.global.peakRequestsPerSecond),
      0,
    );
  } else if (snapshots.length > 0) {
    finalSummary.global.peakRequestsPerSecond = Math.max(
      ...snapshots.map((s) => s.global.peakRequestsPerSecond),
      0,
    );
  } else {
    finalSummary.global.peakRequestsPerSecond = 0;
  }

  // Use only steady-state snapshots for CPU and memory averages
  if (steadyStateSnapshots.length > 0) {
    const cpuSum = steadyStateSnapshots.reduce(
      (sum, s) => sum + s.global.avgSystemCpuUsagePercent,
      0,
    );
    finalSummary.global.avgSystemCpuUsagePercent = cpuSum / steadyStateSnapshots.length;

    const memorySum = steadyStateSnapshots.reduce(
      (sum, s) => sum + s.global.avgProcessMemoryUsageMB,
      0,
    );
    finalSummary.global.avgProcessMemoryUsageMB = memorySum / steadyStateSnapshots.length;
  } else {
    // Fallback to all snapshots if no steady-state data
    const cpuSum = snapshots.reduce((sum, s) => sum + s.global.avgSystemCpuUsagePercent, 0);
    finalSummary.global.avgSystemCpuUsagePercent = cpuSum / snapshots.length;

    const memorySum = snapshots.reduce((sum, s) => sum + s.global.avgProcessMemoryUsageMB, 0);
    finalSummary.global.avgProcessMemoryUsageMB = memorySum / snapshots.length;
  }

  // Calculate global target achieved based on the steady-state average RPS (not the full-duration
  // average and not peak) so the metric genuinely reflects whether the target was sustained over
  // the steady-state window rather than being diluted by the ramp-up period.
  if (finalSummary.configSnapshot?.requests) {
    const totalTargetRps = finalSummary.configSnapshot.requests.reduce(
      (sum, req) => sum + req.rps,
      0,
    );
    if (totalTargetRps > 0) {
      finalSummary.global.targetAchieved =
        finalSummary.global.averageRequestsPerSecond / totalTargetRps;
    }
  }

  // Calculate final endpoint aggregates
  finalSummary.endpoints.forEach((endpoint) => {
    // Get endpoint-specific ramp-up
    const requestConfig = finalSummary.configSnapshot?.requests?.find(
      (req) => req.url === endpoint.url,
    );
    const endpointRampUp = requestConfig?.rampUpDurationSec;
    const effectiveEndpointRampUp = getEffectiveRampUpSec(endpointRampUp, globalRampUpSec);
    const endpointSteadyStateTime = testStartTime + effectiveEndpointRampUp * 1000;

    // Collect endpoint snapshots with their corresponding full snapshots for timestamp filtering
    const endpointSnapshots: EndpointSummary[] = [];
    const endpointSteadyStateSnapshots: EndpointSummary[] = [];

    snapshots.forEach((s) => {
      const ep = s.endpoints.find((e) => e.url === endpoint.url);
      if (ep) {
        endpointSnapshots.push(ep);
        if (s.global.epochEndedAt >= endpointSteadyStateTime) {
          endpointSteadyStateSnapshots.push(ep);
        }
      }
    });

    // Use the endpoint's effective steady-state window for its average RPS so that
    // a long ramp-up doesn't dilute the reported throughput unfairly.
    if (endpointSteadyStateSnapshots.length > 1) {
      const firstSteady = endpointSteadyStateSnapshots[0];
      const lastSteady = endpointSteadyStateSnapshots.at(-1)!;
      const steadyRequests = lastSteady.totalRequests - firstSteady.totalRequests;

      // Find the global snapshot that corresponds to the first steady-state endpoint snapshot
      // to get the correct starting timestamp for the duration calculation.
      const firstSteadyGlobal = snapshots.find((s) =>
        s.endpoints.some(
          (e) => e.url === endpoint.url && e.totalRequests === firstSteady.totalRequests,
        ),
      );
      const steadyDurationMs =
        lastSnapshot.global.epochEndedAt -
        (firstSteadyGlobal?.global.epochEndedAt ?? testStartTime);
      const steadyDurationSec = steadyDurationMs / 1000;

      endpoint.averageRequestsPerSecond =
        steadyDurationSec > 0 ? steadyRequests / steadyDurationSec : 0;
    } else {
      // Fallback: if the ramp-up consumed the entire test or we have insufficient snapshots,
      // use the full duration and total requests so the result is still meaningful.
      const endpointActiveDurationSec =
        totalDurationSec > effectiveEndpointRampUp
          ? totalDurationSec - effectiveEndpointRampUp
          : totalDurationSec;

      endpoint.averageRequestsPerSecond =
        endpointActiveDurationSec > 0 ? endpoint.totalRequests / endpointActiveDurationSec : 0;
    }

    // Use only steady-state snapshots for peak RPS
    // Use peakRequestsPerSecond (the observed peak at that snapshot) not averageRequestsPerSecond
    if (endpointSteadyStateSnapshots.length > 0) {
      endpoint.peakRequestsPerSecond = Math.max(
        ...endpointSteadyStateSnapshots.map((e) => e.peakRequestsPerSecond),
      );
    } else if (endpointSnapshots.length > 0) {
      endpoint.peakRequestsPerSecond = Math.max(
        ...endpointSnapshots.map((e) => e.peakRequestsPerSecond),
      );
    } else {
      endpoint.peakRequestsPerSecond = 0;
    }

    // Use averageRequestsPerSecond (not peak) to reflect sustained rather than momentary throughput.
    if (requestConfig && requestConfig.rps > 0) {
      endpoint.targetAchieved = endpoint.averageRequestsPerSecond / requestConfig.rps;
    }
  });

  return finalSummary;
}

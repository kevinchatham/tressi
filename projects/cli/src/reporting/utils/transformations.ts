import type { EndpointSummary, TestSummary } from '@tressi/shared/common';

function getEffectiveRampUpSec(endpointRampUp: number | undefined, globalRampUp: number): number {
  return endpointRampUp !== undefined && endpointRampUp > 0 ? endpointRampUp : globalRampUp;
}

function calculateSteadyStateAverageRps(
  steadyStateSnapshots: TestSummary[],
  lastSnapshot: TestSummary,
  totalDurationSec: number,
  maxEndpointRampUpSec: number,
): number {
  if (steadyStateSnapshots.length > 1) {
    const firstSteady = steadyStateSnapshots[0];
    const lastSteady = steadyStateSnapshots.at(-1)!;
    const steadyRequests = lastSteady.global.totalRequests - firstSteady.global.totalRequests;
    const steadyDurationMs = lastSteady.global.epochEndedAt - firstSteady.global.epochEndedAt;
    const steadyDurationSec = steadyDurationMs / 1000;
    return steadyDurationSec > 0 ? steadyRequests / steadyDurationSec : 0;
  }

  const globalActiveDurationSec =
    totalDurationSec > maxEndpointRampUpSec
      ? totalDurationSec - maxEndpointRampUpSec
      : totalDurationSec;
  return globalActiveDurationSec > 0
    ? lastSnapshot.global.totalRequests / globalActiveDurationSec
    : 0;
}

function calculatePeakRps(steadyStateSnapshots: TestSummary[], snapshots: TestSummary[]): number {
  if (steadyStateSnapshots.length > 0) {
    return Math.max(...steadyStateSnapshots.map((s) => s.global.peakRequestsPerSecond), 0);
  }
  if (snapshots.length > 0) {
    return Math.max(...snapshots.map((s) => s.global.peakRequestsPerSecond), 0);
  }
  return 0;
}

function calculateGlobalAverages(
  steadyStateSnapshots: TestSummary[],
  snapshots: TestSummary[],
): { cpu: number; memory: number } {
  if (steadyStateSnapshots.length > 0) {
    const cpuSum = steadyStateSnapshots.reduce(
      (sum, s) => sum + s.global.avgSystemCpuUsagePercent,
      0,
    );
    const memorySum = steadyStateSnapshots.reduce(
      (sum, s) => sum + s.global.avgProcessMemoryUsageMB,
      0,
    );
    return {
      cpu: cpuSum / steadyStateSnapshots.length,
      memory: memorySum / steadyStateSnapshots.length,
    };
  }

  const cpuSum = snapshots.reduce((sum, s) => sum + s.global.avgSystemCpuUsagePercent, 0);
  const memorySum = snapshots.reduce((sum, s) => sum + s.global.avgProcessMemoryUsageMB, 0);
  return { cpu: cpuSum / snapshots.length, memory: memorySum / snapshots.length };
}

interface CalculateEndpointAveragesOptions {
  effectiveEndpointRampUp: number;
  endpoint: EndpointSummary;
  endpointSnapshots: EndpointSummary[];
  endpointSteadyStateSnapshots: EndpointSummary[];
  lastSnapshot: TestSummary;
  snapshots: TestSummary[];
  testStartTime: number;
  totalDurationSec: number;
}

function calculateEndpointAverages(options: CalculateEndpointAveragesOptions): {
  avgRps: number;
  peakRps: number;
} {
  const {
    endpoint,
    endpointSnapshots,
    endpointSteadyStateSnapshots,
    snapshots,
    lastSnapshot,
    testStartTime,
    totalDurationSec,
    effectiveEndpointRampUp,
  } = options;
  let avgRps: number;
  if (endpointSteadyStateSnapshots.length > 1) {
    const firstSteady = endpointSteadyStateSnapshots[0];
    const lastSteady = endpointSteadyStateSnapshots.at(-1)!;
    const steadyRequests = lastSteady.totalRequests - firstSteady.totalRequests;

    const firstSteadyGlobal = snapshots.find((s) =>
      s.endpoints.some(
        (e) => e.url === endpoint.url && e.totalRequests === firstSteady.totalRequests,
      ),
    );
    const steadyDurationMs =
      lastSnapshot.global.epochEndedAt - (firstSteadyGlobal?.global.epochEndedAt ?? testStartTime);
    const steadyDurationSec = steadyDurationMs / 1000;
    avgRps = steadyDurationSec > 0 ? steadyRequests / steadyDurationSec : 0;
  } else {
    const activeDuration =
      totalDurationSec > effectiveEndpointRampUp
        ? totalDurationSec - effectiveEndpointRampUp
        : totalDurationSec;
    avgRps = activeDuration > 0 ? endpoint.totalRequests / activeDuration : 0;
  }

  let peakRps: number;
  if (endpointSteadyStateSnapshots.length > 0) {
    peakRps = Math.max(...endpointSteadyStateSnapshots.map((e) => e.peakRequestsPerSecond));
  } else if (endpointSnapshots.length > 0) {
    peakRps = Math.max(...endpointSnapshots.map((e) => e.peakRequestsPerSecond));
  } else {
    peakRps = 0;
  }

  return { avgRps, peakRps };
}

export function transformAggregatedMetricsToTestSummary(snapshots: TestSummary[]): TestSummary {
  if (!snapshots || snapshots.length === 0) {
    throw new Error('Cannot generate test summary without snapshots');
  }

  const lastSnapshot = snapshots.at(-1)!;
  const finalSummary: TestSummary = {
    ...lastSnapshot,
    endpoints: lastSnapshot.endpoints.map((e) => ({ ...e })),
    global: { ...lastSnapshot.global },
  };

  const totalDurationSec = lastSnapshot.global.finalDurationSec;
  const testStartTime = snapshots[0].global.epochStartedAt;
  const globalRampUpSec = finalSummary.configSnapshot?.options?.rampUpDurationSec ?? 0;

  const maxEndpointRampUpSec =
    finalSummary.configSnapshot?.requests?.reduce((max, req) => {
      const effective = getEffectiveRampUpSec(req.rampUpDurationSec, globalRampUpSec);
      return Math.max(max, effective);
    }, globalRampUpSec) ?? globalRampUpSec;

  const globalSteadyStateTime = testStartTime + maxEndpointRampUpSec * 1000;
  const steadyStateSnapshots = snapshots.filter(
    (s) => s.global.epochEndedAt >= globalSteadyStateTime,
  );

  finalSummary.global.averageRequestsPerSecond = calculateSteadyStateAverageRps(
    steadyStateSnapshots,
    lastSnapshot,
    totalDurationSec,
    maxEndpointRampUpSec,
  );

  finalSummary.global.peakRequestsPerSecond = calculatePeakRps(steadyStateSnapshots, snapshots);

  const { cpu, memory } = calculateGlobalAverages(steadyStateSnapshots, snapshots);
  finalSummary.global.avgSystemCpuUsagePercent = cpu;
  finalSummary.global.avgProcessMemoryUsageMB = memory;

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

  finalSummary.endpoints.forEach((endpoint) => {
    const requestConfig = finalSummary.configSnapshot?.requests?.find(
      (req) => req.url === endpoint.url,
    );
    const endpointRampUp = requestConfig?.rampUpDurationSec;
    const effectiveEndpointRampUp = getEffectiveRampUpSec(endpointRampUp, globalRampUpSec);
    const endpointSteadyStateTime = testStartTime + effectiveEndpointRampUp * 1000;

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

    const { avgRps, peakRps } = calculateEndpointAverages({
      effectiveEndpointRampUp,
      endpoint,
      endpointSnapshots,
      endpointSteadyStateSnapshots,
      lastSnapshot,
      snapshots,
      testStartTime,
      totalDurationSec,
    });

    endpoint.averageRequestsPerSecond = avgRps;
    endpoint.peakRequestsPerSecond = peakRps;

    if (requestConfig && requestConfig.rps > 0) {
      endpoint.targetAchieved = endpoint.averageRequestsPerSecond / requestConfig.rps;
    }
  });

  return finalSummary;
}

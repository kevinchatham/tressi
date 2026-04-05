import type { Database, VersionedTressiConfig } from '@tressi/shared/cli';
import {
  type TressiConfig,
  TressiConfigSchema,
  type TressiRequestConfig,
} from '@tressi/shared/common';
import type { Kysely } from 'kysely';
import { createMigration, type Migration } from './migration-utils';

export const migration_0_0_20: Migration = createMigration(
  '0.0.20',
  'Disable early exit if unsafe. Convert errorRateThreshold from 0.0-1.0 to 1-100. Convert monitoringWindowMs to monitoringWindowSeconds.',
  {
    configUp: (config: VersionedTressiConfig): VersionedTressiConfig => {
      const data = config as TressiConfig;
      const $schema = config.$schema.replace(/\d+\.\d+\.\d+/, '0.0.20');

      const convertThreshold = (threshold: number | undefined): number | undefined => {
        if (threshold !== undefined && threshold > 0 && threshold < 1) {
          return Math.round(threshold * 100);
        } else if (threshold === 0) return 1;
        else return threshold;
      };

      const convertMonitoringWindow = (windowMs: unknown): number | undefined => {
        if (typeof windowMs !== 'number') return undefined;
        const converted = Math.round(windowMs / 1000);
        return converted < 1 ? 1 : converted;
      };

      const getWorkerEarlyExit = data.options?.workerEarlyExit as
        | {
            enabled?: boolean;
            errorRateThreshold?: number;
            exitStatusCodes?: number[];
            monitoringWindowMs?: number;
          }
        | undefined;

      const options = data.options
        ? {
            ...data.options,
            workerEarlyExit: getWorkerEarlyExit
              ? {
                  ...getWorkerEarlyExit,
                  errorRateThreshold: convertThreshold(getWorkerEarlyExit.errorRateThreshold),
                  monitoringWindowSeconds: convertMonitoringWindow(
                    getWorkerEarlyExit.monitoringWindowMs,
                  ),
                }
              : getWorkerEarlyExit,
          }
        : data.options;

      const requests = data.requests?.map((request: TressiRequestConfig) => {
        const requestEarlyExit = request.earlyExit as
          | {
              enabled?: boolean;
              errorRateThreshold?: number;
              exitStatusCodes?: number[];
              monitoringWindowMs?: number;
            }
          | undefined;
        return {
          ...request,
          earlyExit: requestEarlyExit
            ? {
                ...requestEarlyExit,
                errorRateThreshold: convertThreshold(requestEarlyExit.errorRateThreshold),
                monitoringWindowSeconds: convertMonitoringWindow(
                  requestEarlyExit.monitoringWindowMs,
                ),
              }
            : requestEarlyExit,
        };
      });

      const convertedConfig = {
        ...data,
        $schema,
        options,
        requests,
      };

      const result = TressiConfigSchema.safeParse(convertedConfig);

      if (result.success) return convertedConfig;

      const disableOptions = data.options
        ? {
            ...data.options,
            workerEarlyExit: getWorkerEarlyExit
              ? {
                  ...getWorkerEarlyExit,
                  enabled: false,
                }
              : getWorkerEarlyExit,
          }
        : data.options;

      const disableRequests = data.requests?.map((request: TressiRequestConfig) => {
        const requestEarlyExit = request.earlyExit as
          | {
              enabled?: boolean;
              errorRateThreshold?: number;
              exitStatusCodes?: number[];
              monitoringWindowMs?: number;
            }
          | undefined;
        return {
          ...request,
          earlyExit: requestEarlyExit
            ? {
                ...requestEarlyExit,
                enabled: false,
              }
            : requestEarlyExit,
        };
      });

      return {
        ...data,
        $schema,
        options: disableOptions,
        requests: disableRequests,
      };
    },
    dbUp: async (db: Kysely<Database>) => {
      const tests = await db.selectFrom('tests').selectAll().execute();

      for (const test of tests) {
        if (!test.summary) continue;

        try {
          const summary = JSON.parse(test.summary);

          if (summary.global && !('earlyExitTriggered' in summary.global)) {
            summary.global.earlyExitTriggered = false;
          }

          if (Array.isArray(summary.endpoints)) {
            for (const endpoint of summary.endpoints) {
              if (!('earlyExitTriggered' in endpoint)) {
                endpoint.earlyExitTriggered = false;
              }
            }
          }

          await db
            .updateTable('tests')
            .set({ summary: JSON.stringify(summary) })
            .where('id', '=', test.id)
            .execute();
        } catch {
          // Skip tests with invalid summary JSON
        }
      }

      const metrics = await db.selectFrom('metrics').selectAll().execute();

      for (const metric of metrics) {
        if (!metric.metric) continue;

        try {
          const metricData = JSON.parse(metric.metric);

          if (metricData.global && !('earlyExitTriggered' in metricData.global)) {
            metricData.global.earlyExitTriggered = false;
          }

          if (Array.isArray(metricData.endpoints)) {
            for (const endpoint of metricData.endpoints) {
              if (!('earlyExitTriggered' in endpoint)) {
                endpoint.earlyExitTriggered = false;
              }
            }
          }

          await db
            .updateTable('metrics')
            .set({ metric: JSON.stringify(metricData) })
            .where('id', '=', metric.id)
            .execute();
        } catch {
          // Skip metrics with invalid metric JSON
        }
      }
    },
  },
);

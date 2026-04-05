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
        return Math.max(1, converted);
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
      const addEarlyExitFieldToSummary = async (row: {
        id: string;
        summary?: string | null;
      }): Promise<void> => {
        if (!row.summary) return;

        try {
          const data = JSON.parse(row.summary);

          if (data.global && !('earlyExitTriggered' in data.global)) {
            data.global.earlyExitTriggered = false;
          }

          if (Array.isArray(data.endpoints)) {
            for (const endpoint of data.endpoints) {
              if (!('earlyExitTriggered' in endpoint)) {
                endpoint.earlyExitTriggered = false;
              }
            }
          }

          await db
            .updateTable('tests')
            .set({ summary: JSON.stringify(data) })
            .where('id', '=', row.id)
            .execute();
        } catch {
          // Skip rows with invalid JSON
        }
      };

      const addEarlyExitFieldToMetric = async (row: {
        id: string;
        metric?: string | null;
      }): Promise<void> => {
        if (!row.metric) return;

        try {
          const data = JSON.parse(row.metric);

          if (data.global && !('earlyExitTriggered' in data.global)) {
            data.global.earlyExitTriggered = false;
          }

          if (Array.isArray(data.endpoints)) {
            for (const endpoint of data.endpoints) {
              if (!('earlyExitTriggered' in endpoint)) {
                endpoint.earlyExitTriggered = false;
              }
            }
          }

          await db
            .updateTable('metrics')
            .set({ metric: JSON.stringify(data) })
            .where('id', '=', row.id)
            .execute();
        } catch {
          // Skip rows with invalid JSON
        }
      };

      const tests = await db.selectFrom('tests').selectAll().execute();
      for (const test of tests) {
        await addEarlyExitFieldToSummary(test);
      }

      const metrics = await db.selectFrom('metrics').selectAll().execute();
      for (const metric of metrics) {
        await addEarlyExitFieldToMetric(metric);
      }
    },
  },
);

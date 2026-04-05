import type { Database, VersionedTressiConfig } from '@tressi/shared/cli';
import type { TressiConfig, TressiRequestConfig } from '@tressi/shared/common';
import type { Kysely } from 'kysely';
import {
  createMigrationWithSummaries,
  dropColumnIfExists,
  type Migration,
} from './migration-utils';

export const migration_0_0_17: Migration = createMigrationWithSummaries(
  '0.0.17',
  {
    configSummary: 'Bump early exit monitoring window configurations > 0 and < 1000 to 1000.',
    dbSummary:
      'WARNING: Destructive migration. Chart data will be reset to support a more accurate summary-based storage format. Final test summaries will remain.',
  },
  {
    configUp: (config: VersionedTressiConfig) => {
      const data = config as TressiConfig;
      const $schema = config.$schema.replace(/\d+\.\d+\.\d+/, '0.0.17');

      const bumpWindow = (window: unknown): number | undefined => {
        if (typeof window !== 'number') return undefined;
        if (window > 0 && window < 1000) {
          return 1000;
        }
        return window;
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
                  monitoringWindowMs: bumpWindow(getWorkerEarlyExit.monitoringWindowMs),
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
                monitoringWindowMs: bumpWindow(requestEarlyExit.monitoringWindowMs),
              }
            : requestEarlyExit,
        };
      });

      return {
        ...data,
        $schema,
        options,
        requests,
      };
    },
    dbUp: async (db: Kysely<Database>) => {
      await dropColumnIfExists(db, 'metrics', 'url', 'idx_metrics_url');
      await db.deleteFrom('metrics').execute();
    },
  },
);

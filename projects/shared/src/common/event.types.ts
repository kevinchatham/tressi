import type { TressiConfig } from './config.types';
import type { TestSummary } from './reporting.types';
import type { TestStatus } from './test.types';

/**
 * Server-Sent Events event names
 * Grouped to avoid magic strings throughout the codebase
 */
export const ServerEvents = {
  CONNECTED: 'connected',
  METRICS: 'metrics',
  TEST: {
    CANCELLED: 'test:cancelled',
    COMPLETED: 'test:completed',
    FAILED: 'test:failed',
    STARTED: 'test:started',
  },
} as const;

/**
 * Type for all server event names
 */
export type ServerEventName =
  | typeof ServerEvents.METRICS
  | typeof ServerEvents.TEST.STARTED
  | typeof ServerEvents.TEST.COMPLETED
  | typeof ServerEvents.TEST.FAILED
  | typeof ServerEvents.TEST.CANCELLED
  | typeof ServerEvents.CONNECTED;

export type ConnectedEventData = {
  timestamp: number;
};

/**
 * Unified event payload structure for all test lifecycle events
 */
export type TestEventData = {
  testId: string;
  timestamp: number;
  status: TestStatus;
  error?: string;
  configId?: string;
};

export interface IGlobalServerEvents {
  metrics: (data: { testId?: string; testSummary: TestSummary }) => void;
  'test:cancelled': (data: TestEventData) => void;
  'test:completed': (data: TestEventData) => void;
  'test:failed': (data: TestEventData) => void;
  'test:started': (data: TestEventData) => void;
}

export interface IRunnerEvents {
  complete: (results: TestSummary) => void;
  error: (err: unknown) => void;
  start: (data: { config: TressiConfig; startTime: number }) => void;
}

export type ServerEventMessage =
  | {
      event: typeof ServerEvents.METRICS;
      data: { testId?: string; testSummary: TestSummary };
    }
  | {
      event:
        | typeof ServerEvents.TEST.STARTED
        | typeof ServerEvents.TEST.COMPLETED
        | typeof ServerEvents.TEST.FAILED
        | typeof ServerEvents.TEST.CANCELLED;
      data: TestEventData;
    }
  | {
      event: 'connected';
      data: ConnectedEventData;
    };

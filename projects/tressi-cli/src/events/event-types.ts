import { TestStatus } from '../database/schema';
import type { TestSummary } from '../reporting/types';

/**
 * Server-Sent Events event names
 * Grouped to avoid magic strings throughout the codebase
 */
export const ServerEvents = {
  METRICS: 'metrics',
  TEST: {
    STARTED: 'test:started',
    COMPLETED: 'test:completed',
    FAILED: 'test:failed',
    CANCELLED: 'test:cancelled',
  },
  CONNECTED: 'connected',
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

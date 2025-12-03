/**
 * Health state information for monitoring
 */
export type HealthState = {
  /** Whether the server is currently healthy */
  isHealthy: boolean;
  /** Timestamp of the last health check */
  lastCheck: Date | null;
  /** Whether a health check is currently in progress */
  isChecking: boolean;
  /** Error object if the last health check failed */
  error: Error | null;
};

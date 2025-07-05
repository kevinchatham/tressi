/**
 * Represents the result of a single request made during the load test.
 */
export interface RequestResult {
  /** The URL that was requested. */
  url: string;
  /** The HTTP status code of the response. */
  status: number;
  /** The time taken for the request to complete, in milliseconds. */
  latencyMs: number;
  /** Whether the request was considered successful. */
  success: boolean;
  /** Any error message if the request failed. */
  error?: string;
  /** The timestamp when the request was completed. */
  timestamp: number;
}

/**
 * Calculates the percentile of a dataset.
 * @param data An array of numbers.
 * @param p The percentile to calculate (0-100).
 * @returns The value at the specified percentile.
 */
export function percentile(data: number[], p: number): number {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a - b);
  const index = Math.floor((p / 100) * (sorted.length -1));
  return sorted[index];
}

/**
 * Calculates the average of a dataset.
 * @param data An array of numbers.
 * @returns The average of the numbers in the array.
 */
export function average(data: number[]): number {
  return data.length ? data.reduce((a, b) => a + b, 0) / data.length : 0;
}

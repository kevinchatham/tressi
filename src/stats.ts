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
  /** The sampled response body, if captured. */
  body?: string;
}

/**
 * Calculates the percentile of a dataset.
 * @param data An array of numbers.
 * @param p The percentile to calculate (0-1).
 * @returns The value at the specified percentile.
 */
export function percentile(data: number[], p: number): number {
  if (data.length === 0) return 0;
  // Ensure the data is sorted
  const sorted =
    data.length === 1 ? [...data] : [...data].sort((a, b) => a - b);
  const index = Math.ceil(p * (sorted.length - 1));

  // If the calculated index is out of bounds, return the last element
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

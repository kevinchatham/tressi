/**
 * Represents the result of a single request made during the load test.
 */
export interface RequestResult {
  /** The HTTP method used for the request. */
  method: string;
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
 * Calculates the percentile of a dataset using the quickselect algorithm.
 * This is much more performant than sorting the entire array.
 * @param data An array of numbers.
 * @param p The percentile to calculate (0-1).
 * @returns The value at the specified percentile.
 */
export function percentile(data: number[], p: number): number {
  if (data.length === 0) return 0;

  const index = Math.ceil(p * (data.length - 1));

  // A mutable copy of the data for the algorithm to work on
  const mutableData = [...data];

  // Quickselect implementation to find the k-th smallest element
  function quickselect(arr: number[], k: number): number {
    const swap = (i: number, j: number): void => {
      [arr[i], arr[j]] = [arr[j], arr[i]];
    };

    let left = 0;
    let right = arr.length - 1;

    while (left <= right) {
      const pivotIndex = Math.floor(Math.random() * (right - left + 1)) + left;
      const pivotValue = arr[pivotIndex];

      swap(pivotIndex, right);
      let storeIndex = left;

      for (let i = left; i < right; i++) {
        if (arr[i] < pivotValue) {
          swap(storeIndex, i);
          storeIndex++;
        }
      }
      swap(right, storeIndex);

      if (storeIndex === k) {
        return arr[storeIndex];
      } else if (storeIndex < k) {
        left = storeIndex + 1;
      } else {
        right = storeIndex - 1;
      }
    }
    return -1; // Should not be reached in this context
  }

  return quickselect(mutableData, index);
}

/**
 * Calculates the average of a dataset.
 * @param data An array of numbers.
 * @returns The average of the numbers in the array.
 */
export function average(data: number[]): number {
  return data.length ? data.reduce((a, b) => a + b, 0) / data.length : 0;
}

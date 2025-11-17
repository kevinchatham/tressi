// Safe directory and file name utilities
export {
  getSafeDirectoryName,
  isValidDirectoryName,
  getSafeFileName,
  getFileExtension,
  removeFileExtension,
  combineSafeFileName,
} from './safe-directory';

// Circular buffer utility (moved from root)
export { CircularBuffer } from './circular-buffer';

// File system utilities
export { FileUtils } from './file-utils';

// Worker utilities
export { getWorkerThreadPath } from './worker-path';

/**
 * Aggregates a status code map into standard categories (2xx, 3xx, 4xx, 5xx).
 * @param statusCodeMap A record where keys are status codes and values are their counts.
 * @returns An object containing the counts for each status code category.
 */
export function getStatusCodeDistributionByCategory(
  statusCodeMap: Record<number, number>,
): {
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
  other: number;
} {
  const distribution = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    other: 0,
  };

  for (const [codeStr, count] of Object.entries(statusCodeMap)) {
    const code = Number(codeStr);
    if (code >= 200 && code < 300) {
      distribution['2xx'] += count;
    } else if (code >= 300 && code < 400) {
      distribution['3xx'] += count;
    } else if (code >= 400 && code < 500) {
      distribution['4xx'] += count;
    } else if (code >= 500 && code < 600) {
      distribution['5xx'] += count;
    } else {
      distribution.other += count;
    }
  }

  return distribution;
}

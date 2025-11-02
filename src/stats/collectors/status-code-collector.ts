/**
 * Collects and manages HTTP status code distribution statistics.
 * This class tracks the count of each status code encountered during load testing
 * and provides categorized distribution statistics.
 */
export class StatusCodeCollector {
  private statusCodeMap: Record<number, number> = {};

  /**
   * Records a status code occurrence.
   * @param status The HTTP status code
   * @param count The number of occurrences (defaults to 1)
   */
  recordStatusCode(status: number, count: number = 1): void {
    this.statusCodeMap[status] = (this.statusCodeMap[status] || 0) + count;
  }

  /**
   * Gets the map of status codes and their counts.
   * @returns A record where keys are status codes and values are their counts
   */
  getStatusCodeMap(): Record<number, number> {
    return { ...this.statusCodeMap };
  }

  /**
   * Gets the count for a specific status code.
   * @param status The HTTP status code
   * @returns The count of occurrences for the status code
   */
  getStatusCodeCount(status: number): number {
    return this.statusCodeMap[status] || 0;
  }

  /**
   * Gets the total count of all status codes.
   * @returns The total count of all requests
   */
  getTotalCount(): number {
    return Object.values(this.statusCodeMap).reduce(
      (sum, count) => sum + count,
      0,
    );
  }

  /**
   * Gets the status code distribution by category (2xx, 3xx, 4xx, 5xx).
   * @returns An object containing the counts for each status code category
   */
  getStatusCodeDistributionByCategory(): {
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

    for (const [codeStr, count] of Object.entries(this.statusCodeMap)) {
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

  /**
   * Checks if any of the specified status codes have occurred.
   * @param statusCodes Array of status codes to check
   * @returns true if any of the specified status codes have occurred
   */
  hasAnyStatusCode(statusCodes: number[]): boolean {
    return statusCodes.some((code) => this.statusCodeMap[code] > 0);
  }

  /**
   * Clears all collected status code data.
   */
  clear(): void {
    this.statusCodeMap = {};
  }
}

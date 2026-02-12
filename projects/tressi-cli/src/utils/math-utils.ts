/**
 * Truncates to X decimal places
 */
export function truncateToDecimals(value: number, places: number = 0): number {
  const multiplier = 10 ** places;
  return Math.trunc(value * multiplier) / multiplier;
}

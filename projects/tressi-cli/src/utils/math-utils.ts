/**
 * Round a number to X decimal places
 * @param value Number to round
 * @returns Rounded number
 */
export function roundToDecimals(value: number, places: number = 0): number {
  const multiplier = Math.pow(10, places);
  return Math.round(value * multiplier) / multiplier;
}

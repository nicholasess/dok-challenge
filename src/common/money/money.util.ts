/**
 * Rounds a number to 2 decimal places using HALF_UP rounding.
 * Returns the result as a string with exactly 2 decimal places.
 *
 * Uses the e-notation trick to avoid floating-point representation issues
 * (e.g. 1.005 * 100 = 100.49999... in IEEE 754).
 */
export function roundHalfUp(value: number): string {
  return (+(Math.round(+(value + 'e+2')) + 'e-2')).toFixed(2);
}

/**
 * Parse YYYY-MM-DD as UTC midnight.
 *
 * @param value - Date string
 * @return Milliseconds since epoch
 */
export function dateToUtcStartMs(value: string): number {
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return ms;
}

/**
 * Exclusive end of a calendar day in UTC (start of next day).
 *
 * @param value - Date string
 * @return Milliseconds since epoch
 */
export function dateToUtcEndExclusiveMs(value: string): number {
  return dateToUtcStartMs(value) + 24 * 60 * 60 * 1000;
}

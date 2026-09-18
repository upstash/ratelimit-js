type Unit = "ms" | "s" | "m" | "h" | "d" | "w";
export type Duration = `${number} ${Unit}` | `${number}${Unit}`;

const MULTIPLIERS: Record<Unit, number> = {
  ms: 1,
  s: 1000,
  m: 1000 * 60,
  h: 1000 * 60 * 60,
  d: 1000 * 60 * 60 * 24,
  w: 1000 * 60 * 60 * 24 * 7,
};

/**
 * Convert a human readable duration to milliseconds
 */
export function ms(d: Duration): number {
  const match = d.match(/^(\d+(?:\.\d+)?)\s?(ms|s|m|h|d|w)$/);
  if (!match) {
    throw new Error(`Unable to parse window size: ${d}`);
  }
  const time = Number.parseFloat(match[1]);
  const unit = match[2] as Unit;

  const multiplier = MULTIPLIERS[unit];
  if (multiplier === undefined) {
    throw new Error(`Unable to parse window size: ${d}`);
  }

  // Durations are sent to Redis as integer milliseconds (PEXPIRE etc.), so
  // decimals are rounded. A value that rounds to 0 would produce a zero-width
  // window, so reject it here with a clear message.
  const result = Math.round(time * multiplier);
  if (result < 1) {
    throw new Error(`Window size must be at least 1 ms, got: ${d}`);
  }
  return result;
}

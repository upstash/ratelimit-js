type Unit = "ms" | "s" | "m" | "h" | "d" | "w";
export type Duration = `${number} ${Unit}` | `${number}${Unit}`;

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

  switch (unit) {
    case "ms": {
      return Math.round(time);
    }
    case "s": {
      return Math.round(time * 1000);
    }
    case "m": {
      return Math.round(time * 1000 * 60);
    }
    case "h": {
      return Math.round(time * 1000 * 60 * 60);
    }
    case "d": {
      return Math.round(time * 1000 * 60 * 60 * 24);
    }
    case "w": {
      return Math.round(time * 1000 * 60 * 60 * 24 * 7);
    }

    default: {
      throw new Error(`Unable to parse window size: ${d}`);
    }
  }
}

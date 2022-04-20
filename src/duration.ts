type Unit = "ms" | "s" | "m" | "h" | "d";
export type Duration = `${number} ${Unit}`;

/**
 * Convert a human readable duration to milliseconds
 */
export function ms(d: Duration): number {
	const [timeString, duration] = d.split(" ") as [string, Duration];
	const time = parseFloat(timeString);
	switch (duration) {
		case "ms":
			return time;
		case "s":
			return time * 1000;
		case "m":
			return time * 1000 * 60;
		case "h":
			return time * 1000 * 60 * 60;
		case "d":
			return time * 1000 * 60 * 60 * 24;

		default:
			throw new Error(`Unable to parse window size: ${d}`);
	}
}

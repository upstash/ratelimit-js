import { Redis } from "@upstash/redis";

export type Geo = {
  country?: string;
  city?: string;
  region?: string;
  ip?: string;
};
export type Event = Geo & {
  identifier: string;
  time: number;
  success: boolean;
};

export type AnalyticsConfig = {
  redis: Redis;
  prefix?: string;
};

export class Analytics {
  private readonly redis: Redis;
  private readonly prefix: string;

  constructor(config: AnalyticsConfig) {
    this.redis = config.redis;
    this.prefix = config.prefix ?? "@upstash/ratelimit";
  }

  public extractGeo(req: { geo?: Geo }): Geo {
    if (typeof req.geo !== "undefined") {
      return req.geo;
    }

    return {};
  }

  public async record(event: Event): Promise<void> {
    // Bucket is a unix timestamp in milliseconds marking the beginning of a day
    const bucket = new Date().setUTCHours(0, 0, 0, 0).toFixed(0);
    const key = [this.prefix, "events", bucket].join(":");
    await this.redis.hincrby(
      key,
      JSON.stringify({
        ...event,
        time: undefined,
      }),
      1,
    );
  }

  /**
   * Aggregates the events by the given field and returns the number of successes and failures per value
   *
   * @param aggregateBy - The field to aggregate by
   * @param cutoff - Timestamp in milliseconds to limit the aggregation to `cutoff` until now
   * @returns
   */
  async aggregate<TAggregateBy extends keyof Omit<Event, "time">>(
    aggregateBy: TAggregateBy,
    cutoff = 0,
  ): Promise<Record<string, { success: number; blocked: number }>[]> {
    const keys: string[] = [];
    let cursor = 0;
    do {
      const [nextCursor, found] = await this.redis.scan(cursor, {
        match: [this.prefix, "events", "*"].join(":"),
        count: 1000,
      });

      cursor = nextCursor;
      for (const key of found) {
        const timestamp = parseInt(key.split(":").pop()!);
        // Take all the keys that at least overlap with the given timestamp
        if (timestamp >= cutoff) {
          keys.push(key);
        }
      }
    } while (cursor !== 0);

    const days = await Promise.all(
      keys.sort().map(async (key) => {
        const fields = await this.redis.hgetall<Record<string, number>>(key);
        if (!fields) {
          return {};
        }
        const day = {} as Record<string, { success: number; blocked: number }>;

        for (const [field, count] of Object.entries(fields)) {
          const r = JSON.parse(field);
          for (const [k, v] of Object.entries(r) as [TAggregateBy, string][]) {
            if (k !== aggregateBy) {
              continue;
            }
            if (!day[v]) {
              day[v] = {
                success: 0,
                blocked: 0,
              };
            }
            if (r.success) {
              day[v].success += count;
            } else {
              day[v].blocked += count;
            }
          }
        }
        return day;
      }),
    );
    return days;
  }
}

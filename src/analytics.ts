import { Redis } from "https://deno.land/x/upstash_redis@v1.19.3/mod.ts";

export type Event = {
  time: number;
  success: boolean;
  country?: string;
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

  public parseRequest(req: { geo?: { country?: string } }): Event {
    if (req.geo?.country) {
      return {
        time: Date.now(),
        success: true,
        country: req.geo.country,
      };
    }

    return {
      time: Date.now(),
      success: true,
    };
  }

  public async record(event: Event): Promise<void> {
    // Bucket is a unix timestamp in milliseconds marking the beginning of a day
    const bucket = (new Date().setUTCHours(0, 0, 0)).toFixed(0);
    const key = [this.prefix, "events", bucket].join(":");

    await this.redis.sadd(key, event);
  }

  // Returns all events since the given timestamp in chronological ascending order
  async getEvents(opts: { since: number }): Promise<Event[]> {
    const keys: string[] = [];
    let cursor = 0;
    do {
      const [nextCursor, found] = await this.redis.scan(
        cursor,
        { match: [this.prefix, "events", "*"].join(":") },
      );

      cursor = nextCursor;
      for (const key of found) {
        const timestamp = parseInt(key.split(":").pop()!);
        // Take all the keys that at least overlap with the given timestamp
        if (timestamp > opts.since - 60 * 60 * 1000) {
          keys.push(key);
        }
      }
    } while (cursor !== 0);

    const buckets = await Promise.all(
      keys.map((key) => this.redis.smembers<Event[]>(key)),
    );

    return buckets.flat().sort((a, b) => a.time - b.time);
  }
}

import { Analytics as CoreAnalytics } from "@upstash/core-analytics";
import type { Redis } from "@upstash/redis";

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

/**
 * The Analytics package is experimental and can change at any time.
 */
export class Analytics {
  private readonly analytics: CoreAnalytics;
  private readonly table = "events";

  constructor(config: AnalyticsConfig) {
    this.analytics = new CoreAnalytics({
      redis: config.redis,
      window: "1h",
      prefix: config.prefix ?? "@upstash/ratelimit",
      retention: "90d",
    });
  }

  /**
   * Try to extract the geo information from the request
   *
   * This handles Vercel's `req.geo` and  and Cloudflare's `request.cf` properties
   * @param req
   * @returns
   */
  public extractGeo(req: { geo?: Geo; cf?: Geo }): Geo {
    if (typeof req.geo !== "undefined") {
      return req.geo;
    }
    if (typeof req.cf !== "undefined") {
      return req.cf;
    }

    return {};
  }

  public async record(event: Event): Promise<void> {
    await this.analytics.ingest(this.table, event);
  }

  async series<TFilter extends keyof Omit<Event, "time">>(
    filter: TFilter,
    cutoff = 0,
  ): Promise<({ time: number } & Record<string, number>)[]> {
    const records = await this.analytics.query(this.table, {
      filter: [filter],
      range: cutoff ? [cutoff] : undefined,
    });
    return records;
  }
  public async getUsage(cutoff = 0): Promise<Record<string, { success: number; blocked: number }>> {
    const records = await this.analytics.aggregateBy(this.table, "identifier", {
      range: cutoff ? [cutoff] : undefined,
    });
    const usage = {} as Record<string, { success: number; blocked: number }>;
    for (const bucket of records) {
      for (const [k, v] of Object.entries(bucket)) {
        if (k === "time") {
          continue;
        }
        if (!usage[k]) {
          usage[k] = { success: 0, blocked: 0 };
        }
        usage[k].success += v as number;
        usage[k].blocked += v as number;
      }
    }
    return usage;
  }
}

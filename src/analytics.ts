import { Analytics as CoreAnalytics } from "@upstash/core-analytics";
import type { Redis } from "./types";

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
  cache?: boolean
};

/**
 * The Analytics package is experimental and can change at any time.
 */
export class Analytics {
  private readonly analytics: CoreAnalytics;
  private readonly table = "events";

  constructor(config: AnalyticsConfig) {
    this.analytics = new CoreAnalytics({
      // @ts-expect-error we need to fix the types in core-analytics, it should only require the methods it needs, not the whole sdk
      redis: config.redis,
      window: "1h",
      prefix: config.prefix ?? "@upstash/ratelimit",
      retention: "90d",
      cache: config.cache
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

  public async series<TFilter extends keyof Omit<Event, "time">>(
    cutoff: number,
  ): Promise<{time: number, success: {true: number, false: number}}[]> {
    // TODO: calculate numTimestamps from cutoff
    return this.analytics.aggregateBuckets(this.table, 24)
  }

  public async getUsage(cutoff = 0): Promise<Record<string, { success: number; blocked: number }>> {
    // TODO: calculate numTimestamps from cutoff
    const records = await this.analytics.getAllowedBlocked(this.table, 24)
    return records;
  }

  public async getUsageOverTime(timestampCount: number) {
    const result = await this.analytics.aggregateBucketsWithPipeline(this.table, timestampCount)
    return result
  }

  public async getMostAllowedBlocked(timestampCount: number, getTop?: number) {
    getTop = getTop ?? 5
    return this.analytics.getMostAllowedBlocked(this.table, timestampCount, getTop)
  }
}

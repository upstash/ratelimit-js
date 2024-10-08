import type { Aggregate } from "@upstash/core-analytics";
import { Analytics as CoreAnalytics } from "@upstash/core-analytics";
import type { Redis } from "./types";

export type Geo = {
  country?: string;
  city?: string;
  region?: string;
  ip?: string;
};

/**
 * denotes the success field in the analytics submission.
 * Set to true when ratelimit check passes. False when request is ratelimited.
 * Set to "denied" when some request value is in deny list.
 */
export type EventSuccess = boolean | "denied"

export type Event = Geo & {
  identifier: string;
  time: number;
  success: EventSuccess;
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
      // @ts-expect-error we need to fix the types in core-analytics, it should only require the methods it needs, not the whole sdk
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
    if (req.geo !== undefined) {
      return req.geo;
    }
    if (req.cf !== undefined) {
      return req.cf;
    }

    return {};
  }

  public async record(event: Event): Promise<void> {
    await this.analytics.ingest(this.table, event);
  }

  public async series<TFilter extends keyof Omit<Event, "time">>(
    filter: TFilter,
    cutoff: number,
  ): Promise<Aggregate[]> {
    const timestampCount = Math.min(
      (
        this.analytics.getBucket(Date.now())
        - this.analytics.getBucket(cutoff)
      ) / (60 * 60 * 1000),
      256
    )
    return this.analytics.aggregateBucketsWithPipeline(this.table, filter, timestampCount)
  }

  public async getUsage(cutoff = 0): Promise<Record<string, { success: number; blocked: number }>> {
    
    const timestampCount = Math.min(
      (
        this.analytics.getBucket(Date.now())
        - this.analytics.getBucket(cutoff)
      ) / (60 * 60 * 1000),
      256
    )
    const records = await this.analytics.getAllowedBlocked(this.table, timestampCount)
    return records;
  }

  public async getUsageOverTime<TFilter extends keyof Omit<Event, "time">>(
    timestampCount: number, groupby: TFilter
  ): Promise<Aggregate[]> {
    const result = await this.analytics.aggregateBucketsWithPipeline(this.table, groupby, timestampCount)
    return result
  }

  public async getMostAllowedBlocked(timestampCount: number, getTop?: number, checkAtMost?: number) {
    getTop = getTop ?? 5
    const timestamp = undefined // let the analytics handle getting the timestamp
    return this.analytics.getMostAllowedBlocked(this.table, timestampCount, getTop, timestamp, checkAtMost)
  }
}

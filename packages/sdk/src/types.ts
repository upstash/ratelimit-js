import type { Redis } from "@upstash/redis";
/**
 * EphemeralCache is used to block certain identifiers right away in case they have already exceedd the ratelimit.
 */
export interface EphemeralCache {
  isBlocked: (identifier: string) => { blocked: boolean; reset: number };
  blockUntil: (identifier: string, reset: number) => void;

  set: (key: string, value: number) => void;
  get: (key: string) => number | null;

  incr: (key: string) => number;
}

export type RegionContext = { redis: Redis; cache?: EphemeralCache };
export type MultiRegionContext = { redis: Redis[]; cache?: EphemeralCache };

export type Context = RegionContext | MultiRegionContext;
export type RatelimitResponse = {
  /**
   * Whether the request may pass(true) or exceeded the limit(false)
   */
  success: boolean;
  /**
   * Maximum number of requests allowed within a window.
   */
  limit: number;
  /**
   * How many requests the user has left within the current window.
   */
  remaining: number;
  /**
   * Unix timestamp in milliseconds when the limits are reset.
   */
  reset: number;

  /**
   * For the MultiRegion setup we do some synchronizing in the background, after returning the current limit.
   * In most case you can simply ignore this.
   *
   * On Vercel Edge or Cloudflare workers, you need to explicitely handle the pending Promise like this:
   *
   * **Vercel Edge:**
   * https://nextjs.org/docs/api-reference/next/server#nextfetchevent
   *
   * ```ts
   * const { pending } = await ratelimit.limit("id")
   * event.waitUntil(pending)
   * ```
   *
   * **Cloudflare Worker:**
   * https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#syntax-module-worker
   *
   * ```ts
   * const { pending } = await ratelimit.limit("id")
   * context.waitUntil(pending)
   * ```
   */
  pending: Promise<unknown>;
};

export type Algorithm<TContext> = (
  ctx: TContext,
  identifier: string,
  opts?: {
    cache?: EphemeralCache;
  },
) => Promise<RatelimitResponse>;

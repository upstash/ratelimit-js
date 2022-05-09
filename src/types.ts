export interface Redis {
  eval: (script: string, keys: string[], values: unknown[]) => Promise<unknown>;
  sadd: (key: string, ...members: string[]) => Promise<number>;
}

export type RegionContext = { redis: Redis };
export type GlobalContext = { redis: Redis[] };

export type Context = RegionContext | GlobalContext;
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
};

export type Algorithm<TContext> = (
  ctx: TContext,
  identifier: string,
) => Promise<RatelimitResponse>;

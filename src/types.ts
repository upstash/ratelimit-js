import type { Redis } from "https://deno.land/x/upstash_redis/mod.ts";
export { Redis };
// Define all methods of @upstash/redis we need, so we don't need to explicitely import it and be tied down
// to a specific platforms way of importing
// export type Redis = {
//   eval: <TValues extends unknown[], TData>(
//     script: string,
//     keys: string[],
//     values: TValues
//   ) => Promise<TData>;
// };
export type Context = { redis: Redis };

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

export type Ratelimiter = (
  ctx: Context,
  identifier: string,
) => Promise<RatelimitResponse>;

import { Cache } from "./cache";
import type {
  Algorithm,
  Context,
  LimitOptions,
  RatelimitResponse,
  Redis,
} from "./types";

export class TimeoutError extends Error {
  constructor() {
    super("Timeout");
    this.name = "TimeoutError";
  }
}
export type RatelimitConfig<TContext> = {
  /**
   * The ratelimiter function to use.
   *
   * Choose one of the predefined ones or implement your own.
   * Available algorithms are exposed via static methods:
   * - Ratelimiter.fixedWindow
   * - Ratelimiter.slidingWindow
   * - Ratelimiter.tokenBucket
   */

  limiter: Algorithm<TContext>;

  ctx: TContext;
  /**
   * All keys in redis are prefixed with this.
   *
   * @default `@linklet-io/node-redis-ratelimit-js`
   */
  prefix?: string;

  /**
   * If enabled, the ratelimiter will keep a global cache of identifiers, that have
   * exhausted their ratelimit. In serverless environments this is only possible if
   * you create the ratelimiter instance outside of your handler function. While the
   * function is still hot, the ratelimiter can block requests without having to
   * request data from redis, thus saving time and money.
   *
   * Whenever an identifier has exceeded its limit, the ratelimiter will add it to an
   * internal list together with its reset timestamp. If the same identifier makes a
   * new request before it is reset, we can immediately reject it.
   *
   * Set to `false` to disable.
   *
   * If left undefined, a map is created automatically, but it can only work
   * if the map or the  ratelimit instance is created outside your serverless function handler.
   */
  ephemeralCache?: Map<string, number> | false;

  /**
   * If set, the ratelimiter will allow requests to pass after this many milliseconds.
   *
   * Use this if you want to allow requests in case of network problems
   *
   * @default 5000
   */
  timeout?: number;
};

/**
 * Ratelimiter using redis
 *
 * @example
 * ```ts
 * const { limit } = new Ratelimit({
 *    redis: createClient(),
 *    limiter: Ratelimit.slidingWindow(
 *      10,     // Allow 10 requests per window of 30 minutes
 *      "30 m", // interval of 30 minutes
 *    ),
 * })
 *
 * ```
 */
export abstract class Ratelimit<TContext extends Context> {
  protected readonly limiter: Algorithm<TContext>;

  protected readonly ctx: TContext;

  protected readonly prefix: string;

  protected readonly timeout: number;

  protected readonly primaryRedis: Redis;

  constructor(config: RatelimitConfig<TContext>) {
    this.ctx = config.ctx;
    this.limiter = config.limiter;
    this.timeout = config.timeout ?? 5000;
    this.prefix = config.prefix ?? "@linklet-io/node-redis-ratelimit-js";

    this.primaryRedis = this.ctx.redis;

    if (config.ephemeralCache instanceof Map) {
      this.ctx.cache = new Cache(config.ephemeralCache);
    } else if (config.ephemeralCache === undefined) {
      this.ctx.cache = new Cache(new Map());
    }
  }

  /**
   * Determine if a request should pass or be rejected based on the identifier and previously chosen ratelimit.
   *
   * Use this if you want to reject all requests that you can not handle right now.
   *
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: createClient(),
   *    limiter: Ratelimit.slidingWindow(10, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.limit(id)
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   *
   * @param req.rate - The rate at which tokens will be added or consumed from the token bucket. A higher rate allows for more requests to be processed. Defaults to 1 token per interval if not specified.
   *
   * Usage with `req.rate`
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: createClient(),
   *    limiter: Ratelimit.slidingWindow(100, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.limit(id, {rate: 10})
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   */
  public limit = async (
    identifier: string,
    req?: LimitOptions
  ): Promise<RatelimitResponse> => {
    let timeoutId: any = null;
    try {
      const response = this.getRatelimitResponse(identifier, req);
      const { responseArray, newTimeoutId } = this.applyTimeout(response);
      timeoutId = newTimeoutId;

      return await Promise.race(responseArray);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  /**
   * Block until the request may pass or timeout is reached.
   *
   * This method returns a promise that resolves as soon as the request may be processed
   * or after the timeout has been reached.
   *
   * Use this if you want to delay the request until it is ready to get processed.
   *
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: createClient(),
   *    limiter: Ratelimit.slidingWindow(10, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.blockUntilReady(id, 60_000)
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   */
  public blockUntilReady = async (
    /**
     * An identifier per user or api.
     * Choose a userID, or api token, or ip address.
     *
     * If you want to limit your api across all users, you can set a constant string.
     */
    identifier: string,
    /**
     * Maximum duration to wait in milliseconds.
     * After this time the request will be denied.
     */
    timeout: number
  ): Promise<RatelimitResponse> => {
    if (timeout <= 0) {
      throw new Error("timeout must be positive");
    }
    let res: RatelimitResponse;

    const deadline = Date.now() + timeout;
    while (true) {
      res = await this.limit(identifier);
      if (res.success) {
        break;
      }
      if (res.reset === 0) {
        throw new Error("This should not happen");
      }

      const wait = Math.min(res.reset, deadline) - Date.now();
      await new Promise((r) => setTimeout(r, wait));

      if (Date.now() > deadline) {
        break;
      }
    }
    return res!;
  };

  public resetUsedTokens = async (identifier: string) => {
    const pattern = [this.prefix, identifier].join(":");
    await this.limiter().resetTokens(this.ctx, pattern);
  };

  /**
   * Returns the remaining token count together with a reset timestamps
   *
   * @param identifier identifir to check
   * @returns object with `remaining` and reset fields. `remaining` denotes
   *          the remaining tokens and reset denotes the timestamp when the
   *          tokens reset.
   */
  public getRemaining = async (
    identifier: string
  ): Promise<{
    remaining: number;
    reset: number;
  }> => {
    const pattern = [this.prefix, identifier].join(":");

    return await this.limiter().getRemaining(this.ctx, pattern);
  };

  /**
   * Calls redis to check the rate limit. Returns after
   * resolving the result.
   *
   * @param identifier identifier to block
   * @param req options with ip, user agent, country, rate and geo info
   * @returns rate limit response
   */
  private getRatelimitResponse = async (
    identifier: string,
    req?: LimitOptions
  ): Promise<RatelimitResponse> => {
    const key = this.getKey(identifier);
    return this.limiter().limit(this.ctx, key, req?.rate);
  };

  /**
   * Creates an array with the original response promise and a timeout promise
   * if this.timeout > 0.
   *
   * @param response Ratelimit response promise
   * @returns array with the response and timeout promise. also includes the timeout id
   */
  private applyTimeout = (response: Promise<RatelimitResponse>) => {
    let newTimeoutId: any = null;
    const responseArray: Array<Promise<RatelimitResponse>> = [response];

    if (this.timeout > 0) {
      const timeoutResponse = new Promise<RatelimitResponse>((resolve) => {
        newTimeoutId = setTimeout(() => {
          resolve({
            success: true,
            limit: 0,
            remaining: 0,
            reset: 0,
            reason: "timeout",
          });
        }, this.timeout);
      });
      responseArray.push(timeoutResponse);
    }

    return {
      responseArray,
      newTimeoutId,
    };
  };

  private getKey = (identifier: string): string => {
    return [this.prefix, identifier].join(":");
  };

  /**
   * returns a list of defined values from
   * [identifier, req.ip, req.userAgent, req.country]
   *
   * @param identifier identifier
   * @param req limit options
   * @returns list of defined values
   */
  private getDefinedMembers = (
    identifier: string,
    req?: Pick<LimitOptions, "ip" | "userAgent" | "country">
  ): string[] => {
    const members = [identifier, req?.ip, req?.userAgent, req?.country];
    return (members as string[]).filter(Boolean);
  };
}

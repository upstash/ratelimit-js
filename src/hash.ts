import type { ScriptInfo } from "./lua-scripts/hash";
import type { RegionContext } from "./types";

/**
 * Errors returned by redis calls in the limit path. Kept so that `limit()`
 * only handles errors from redis when `allowOnError` is set, and setup
 * mistakes are still thrown.
 */
const redisErrors = new WeakSet<object>();

/**
 * Marks the error of a rejected redis call as a redis error and rethrows it.
 *
 * @param request promise returned by the redis client
 * @returns result of the request
 */
export const redisCall = async <T>(request: Promise<T>): Promise<T> => {
  try {
    return await request;
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      redisErrors.add(error);
    }
    throw error;
  }
};

/**
 * Checks if the error came from a redis call. In multi region, `Promise.any`
 * rejects with an AggregateError, which is a redis error if every region's is.
 *
 * @param error error to check
 * @returns true if the error came from redis
 */
export const isRedisError = (error: unknown): boolean => {
  if (error instanceof AggregateError) {
    return error.errors.length > 0 && error.errors.every((inner) => isRedisError(inner));
  }
  return typeof error === "object" && error !== null && redisErrors.has(error);
};

/**
 * Runs the specified script with EVALSHA using the scriptHash parameter.
 * 
 * If the EVALSHA fails, loads the script to redis and runs again with the
 * hash returned from Redis.
 * 
 * @param ctx Regional or multi region context
 * @param script ScriptInfo of script to run. Contains the script and its hash
 * @param keys eval keys
 * @param args eval args
 */
export const safeEval = async (
  ctx: RegionContext,
  script: ScriptInfo,
  keys: any[],
  args: any[],
) => {
  try {
    return await redisCall(ctx.redis.evalsha(script.hash, keys, args))
  } catch (error) {
    if (`${error}`.includes("NOSCRIPT")) {
      return await redisCall(ctx.redis.eval(script.script, keys, args))
    }
    throw error;
  }
}
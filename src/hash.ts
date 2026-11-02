import { withoutKeyLocking, type ScriptInfo } from "./lua-scripts/hash";
import type { RegionContext } from "./types";

/**
 * Runs the specified script with EVALSHA using the scriptHash parameter.
 * 
 * If the EVALSHA fails, loads the script to redis and runs again with the
 * hash returned from Redis.
 *
 * If key locking is disabled in the context, the `allow-key-locking` shebang
 * is removed from the script before running it.
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
  const scriptInfo = ctx.keyLocking === false ? withoutKeyLocking(script) : script;
  try {
    return await ctx.redis.evalsha(scriptInfo.hash, keys, args)
  } catch (error) {
    if (`${error}`.includes("NOSCRIPT")) {
      return await ctx.redis.eval(scriptInfo.script, keys, args)
    }
    throw error;
  }
}
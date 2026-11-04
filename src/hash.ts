import type { ScriptInfo } from "./lua-scripts/hash";
import type { RegionContext } from "./types";

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
  args: any[]
) => {
  const allowKeyLocking = ctx.allowKeyLocking ?? true;
  const targetScript =
    !allowKeyLocking && script.noKeyLockingScript ? script.noKeyLockingScript : script.script;
  const targetHash =
    !allowKeyLocking && script.noKeyLockingHash ? script.noKeyLockingHash : script.hash;

  try {
    return await ctx.redis.evalsha(targetHash, keys, args);
  } catch (error) {
    if (`${error}`.includes("NOSCRIPT")) {
      try {
        return await ctx.redis.eval(targetScript, keys, args);
      } catch (evalError) {
        if (`${evalError}`.includes("allow-key-locking") && script.noKeyLockingScript) {
          ctx.allowKeyLocking = false;
          return await ctx.redis.eval(script.noKeyLockingScript, keys, args);
        }
        throw evalError;
      }
    }
    if (`${error}`.includes("allow-key-locking") && script.noKeyLockingScript) {
      ctx.allowKeyLocking = false;
      return await ctx.redis.eval(script.noKeyLockingScript, keys, args);
    }
    throw error;
  }
};

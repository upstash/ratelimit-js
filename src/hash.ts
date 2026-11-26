import type { ScriptInfo } from "./lua-scripts/hash";
import type { RegionContext } from "./types";

/**
 * OSS Redis and Valkey reject the Upstash-only `allow-key-locking` script flag
 * with "ERR Unexpected flag in script shebang: allow-key-locking", which breaks
 * the documented local development setup. Upstash runs the same scripts fine
 * without the flag (under the global lock), so retry once without the shebang
 * when the server reports an unsupported flag.
 */
export const isUnsupportedShebangFlagError = (error: unknown): boolean => {
  const message = `${error}`;
  return (
    message.includes("Unexpected flag in script shebang") ||
    message.includes("Unknown lua shebang option")
  );
};

export const stripLuaShebang = (script: string): string =>
  script.replace(/^#!.*\n/, "");

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
  const evalWithoutShebang = async () =>
    await ctx.redis.eval(stripLuaShebang(script.script), keys, args);

  try {
    return await ctx.redis.evalsha(script.hash, keys, args)
  } catch (error) {
    if (isUnsupportedShebangFlagError(error)) {
      return await evalWithoutShebang();
    }
    if (`${error}`.includes("NOSCRIPT")) {
      try {
        return await ctx.redis.eval(script.script, keys, args)
      } catch (evalError) {
        if (isUnsupportedShebangFlagError(evalError)) {
          return await evalWithoutShebang();
        }
        throw evalError;
      }
    }
    throw error;
  }
}
import { Context, RegionContext } from "./types"

type ScriptKind = "limitHash" | "getRemainingHash" | "resetHash"

/**
 * Loads the scripts to redises with SCRIPT LOAD if the first region context
 * doesn't have the kind of script hash in it. 
 * 
 * @param ctx Regional or multi region context
 * @param script script to load
 * @param kind script kind
 */
const setHash = async (
  ctx: Context,
  script: string,
  kind: ScriptKind
) => {
  const regionContexts = "redis" in ctx ? [ctx] : ctx.regionContexts
  const hashSample = regionContexts[0].scriptHashes[kind]
  if (!hashSample) {
    await Promise.all(regionContexts.map(async (context) => {
      context.scriptHashes[kind] = await context.redis.scriptLoad(script)
    }));
  };
}

/**
 * Runds the specified script with EVALSHA if ctx.cacheScripts or EVAL
 * otherwise.
 * 
 * If the script is not found when EVALSHA is used, it submits the script
 * with LOAD SCRIPT, then calls EVALSHA again.
 * 
 * @param ctx Regional or multi region context
 * @param script script to run
 * @param kind script kind
 * @param keys 
 * @param args 
 */
export const safeEval = async (
  ctx: RegionContext,
  script: string,
  kind: ScriptKind,
  keys: any[],
  args: any[],
) => {
  if (!ctx.cacheScripts) {
    return await ctx.redis.eval(script, keys, args);
  };

  await setHash(ctx, script, kind);
  try {
    return await ctx.redis.evalsha(ctx.scriptHashes[kind]!, keys, args)
  } catch (error) {
    if (`${error}`.includes("NOSCRIPT")) {
      console.log("Script with the expected hash was not found in redis db. It is probably flushed. Will load another scipt before continuing.");
      ctx.scriptHashes[kind] = undefined;
      await setHash(ctx, script, kind)
      console.log("  New script successfully loaded.")
      return await ctx.redis.evalsha(ctx.scriptHashes[kind]!, keys, args)
    }
    throw error;
  }
}
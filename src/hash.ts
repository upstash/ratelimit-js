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
export const setHash = async (
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
 * As we send more and more requests, we will potentially increase the size
 * of the script cache of the redis server indefinitely. This is especially
 * important in the case of serverless environments, since a SCRIPT LOAD will
 * be executed in every cold start.
 * 
 * To deal with this issue, we periodically flush the script cache. The
 * frequency of the flushed depends on the scriptFlushFrequency parameter.
 * If set to 1/n, scripts will be flushed every n limit() invocation in average.
 * 
 * @param ctx region or multi region context
 */
export const flushScriptCache = async (
  ctx: Context,
) => {
  const context = ("redis" in ctx) ? ctx : ctx.regionContexts[0]
  if (Math.random() < context.scriptFlushFrequency) {
    const redisArray = ("redis" in ctx) ? [ctx.redis] : ctx.regionContexts.map((region => region.redis))
    await Promise.all(redisArray.map(
      redis => redis.scriptFlush()
    ))
  }
}

/**
 * 
 * Since we periodically flush the script cache of the redis db, it is possible
 * to delete the scripts in the shared redis db of two serverless environments.
 * 
 * Therefore, when we send the requests, we need to handle the case when we have
 * a script hash but it doesn't exist in the redis db, which will return an error
 * 
 * @param ctx 
 * @param script 
 * @param kind 
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
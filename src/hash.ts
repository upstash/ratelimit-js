import type { ScriptInfo } from "./lua-scripts/hash";
import type { RegionContext } from "./types";
import { VERSION } from "./version";

const SCRIPT_NAME_PREFIX = "ratelimit-typescript";

/**
 * Returns the script to send to Redis.
 *
 * With `withFlags`, the script starts with a shebang carrying two flags which
 * only Upstash Redis understands:
 * - `script_name`: names the script in Upstash's script metrics, for example
 *   `ratelimit-typescript-2.1.0-sliding_window_limit`
 * - `flags=allow-key-locking`: lets scripts for different keys run in
 *   parallel. Only added to scripts which declare all their keys.
 */
export const buildScript = (info: ScriptInfo, withFlags: boolean): string => {
  if (!withFlags) return info.script;
  const flags = info.keyLocking ? " flags=allow-key-locking" : "";
  return `#!lua script_name=${SCRIPT_NAME_PREFIX}-${VERSION}-${info.name}${flags}\n${info.script}`;
}

const hashes = new Map<string, Promise<string | undefined>>();

/**
 * sha1 of the script, as Redis computes it for EVALSHA. The script name holds
 * the sdk version, so the hashes can't be hardcoded.
 *
 * Returns undefined when the runtime has no WebCrypto. The script is then sent
 * with EVAL every time.
 */
export const scriptHash = (script: string): Promise<string | undefined> => {
  let hash = hashes.get(script);
  if (!hash) {
    hash = sha1(script);
    hashes.set(script, hash);
  }
  return hash;
}

const sha1 = async (script: string): Promise<string | undefined> => {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) return undefined;
  try {
    const digest = await subtle.digest("SHA-1", new TextEncoder().encode(script));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

/**
 * Redis clients whose server rejected the Upstash flags. Scripts are sent
 * without them from then on.
 */
const flagsRejected = new WeakSet<object>();
let warned = false;

/**
 * Errors which mean the server doesn't accept the Upstash flags in the shebang:
 * - Redis 7+ and Valkey: `Unexpected flag in script shebang: allow-key-locking`
 *   or `Unknown lua shebang option: script_name`
 * - Redis 6 and older, which don't know shebangs: a lua syntax error near `#`
 */
export const isScriptFlagError = (error: unknown): boolean => {
  const message = `${error}`;
  return /shebang/i.test(message) || message.includes("near '#'");
}

const warnFlagsRejected = () => {
  if (warned) return;
  warned = true;
  console.warn(
    "[Upstash Ratelimit] Your Redis server rejected the Upstash flags in the lua scripts " +
    "(allow-key-locking and script_name), so the scripts are sent without them. " +
    "This is expected with self-hosted Redis or serverless-redis-http. " +
    "Set `enableUpstashScriptFlags: false` in the Ratelimit config to send the scripts without " +
    "the flags from the start and to hide this warning.",
  );
}

const evalWithHash = async (
  redis: RegionContext["redis"],
  script: string,
  keys: any[],
  args: any[],
) => {
  const hash = await scriptHash(script);
  if (!hash) {
    return await redis.eval(script, keys, args);
  }
  try {
    return await redis.evalsha(hash, keys, args);
  } catch (error) {
    if (`${error}`.includes("NOSCRIPT")) {
      return await redis.eval(script, keys, args);
    }
    throw error;
  }
}

/**
 * Runs the script with EVALSHA, and with EVAL if Redis doesn't have it yet.
 *
 * Unless `enableUpstashScriptFlags` is false, the script is sent with the Upstash
 * flags (see `buildScript`). If the user left `enableUpstashScriptFlags` unset and
 * the server rejects the flags, the script is run again without them, a
 * warning is printed once, and the flags are left off for that client from
 * then on.
 *
 * @param ctx Regional or multi region context
 * @param info the script to run
 * @param keys eval keys
 * @param args eval args
 */
export const safeEval = async (
  ctx: RegionContext,
  info: ScriptInfo,
  keys: any[],
  args: any[],
) => {
  const withFlags = ctx.enableUpstashScriptFlags !== false && !flagsRejected.has(ctx.redis);
  try {
    return await evalWithHash(ctx.redis, buildScript(info, withFlags), keys, args);
  } catch (error) {
    if (withFlags && ctx.enableUpstashScriptFlags === undefined && isScriptFlagError(error)) {
      flagsRejected.add(ctx.redis);
      warnFlagsRejected();
      return await ctx.redis.eval(buildScript(info, false), keys, args);
    }
    throw error;
  }
}


import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.IP_BLACK_LIST_UPSTASH_REDIS_REST_URL ?? '***',
  token: process.env.IP_BLACK_LIST_UPSTASH_REDIS_REST_TOKEN ?? '***',
});

const ipCache = new Set();


export type IPBlackListSetting = "cached" | "uncached" | "disabled" 


/**
 * Check if an ip address is in blacklist
 */
export const ipInBlackList = async (ip: string, setting: Exclude<IPBlackListSetting, "disabled">) => {
  const useCache = setting === "cached"
  if (useCache && ipCache.has(ip)) {
    return true;
  };

  // result is null if ip is not in blacklist, otherwise 0
  const result = await redis.get(ip) as null | 0;

  // return true if result is null
  if (result === null) return false;

  // add ip to cache and return true if number
  if (useCache) {
    ipCache.add(ip);
    flushCacheRandomly();
  }
  return true;
}


/**
 * If the environment is not serverless, ipCache will keep
 * growing in size. We should flush it with a random probability.
 * 
 * To do so, we create a random number between 0-1 and flush the
 * cache if it's lower than 0.01.
 */
const flushCacheRandomly = () => {
  if (Math.random() < 0.01) ipCache.clear();
};

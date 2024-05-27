import { beforeAll, describe, expect, test } from "bun:test";
import { Redis } from '@upstash/redis';
import { ipInBlackList, IPBlackListSetting } from './ipBlackList';
import { RegionRatelimit } from "./single";

describe('IP Blacklist Tests', () => {
  let redis: Redis;
  let keys: string[];
  let ratelimit: RegionRatelimit;

  beforeAll(async () => {
    redis = new Redis({
      url: process.env.IP_BLACK_LIST_UPSTASH_REDIS_REST_URL ?? '***',
      token: process.env.IP_BLACK_LIST_UPSTASH_REDIS_REST_TOKEN ?? '***',
    });

    // Get some keys from the redis server
    keys = (await redis.scan(0, { count: 5 }))[1];

    ratelimit = new RegionRatelimit({
        redis: Redis.fromEnv(),
        limiter: RegionRatelimit.fixedWindow(10, "30s"),
        prefix: crypto.randomUUID()
    })
  });

  test('should return true for IPs in the blacklist (cached)', async () => {
    if (keys.length === 0) {
      throw Error('No keys found in Redis to test.');
    }

    const ip = keys[0];
    const result = await ipInBlackList(ip, "cached");
    expect(result).toBe(true);
  });

  test('should return false for IPs not in the blacklist (cached)', async () => {
    const randomIp = 'random-ip-not-in-blacklist';
    const result = await ipInBlackList(randomIp, "cached");
    expect(result).toBe(false);
  });

  test('should return true for IPs in the blacklist (uncached)', async () => {
    if (keys.length === 0) {
      console.warn('No keys found in Redis to test.');
      return;
    }

    const ip = keys[0];
    const result = await ipInBlackList(ip, "uncached");
    expect(result).toBe(true);
  });

  test('should return false for IPs not in the blacklist (uncached)', async () => {
    const randomIp = 'random-ip-not-in-blacklist';
    const result = await ipInBlackList(randomIp, "uncached");
    expect(result).toBe(false);
  });

  test("should use ratelimit result if not in blacklist", async () => {
    const randomIp = 'random-ip-not-in-blacklist';
    const result = await ratelimit.limit(randomIp);
    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
    expect(typeof result.reason).toBe("undefined");
  });

  test("should show ratelimit reason", async () => {
    const randomIp = 'random-ip-not-in-blacklist-2';
    const result = await ratelimit.limit(randomIp, { rate: 30 });
    expect(result.success).toBe(false);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(0);
    expect(result.reason).toBe("ratelimit");
  });

  test("should use ip blacklist result if not in blacklist", async () => {
    const result = await ratelimit.limit(keys[0]);
    expect(result.success).toBe(false);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(0);
    expect(result.reason).toBe("ip-blacklist");
    
  });

  test("should be able to disable ip blacklist", async () => {

    const no_ip_blacklist_ratelimit = new RegionRatelimit({
      redis: Redis.fromEnv(),
      limiter: RegionRatelimit.fixedWindow(10, "30s"),
      prefix: crypto.randomUUID(),
      ipBlackList: "disabled" // disable ip blacklist check
    })

    const result = await no_ip_blacklist_ratelimit.limit(keys[0]);
    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
    expect(typeof result.reason).toBe("undefined");
    
  });
});

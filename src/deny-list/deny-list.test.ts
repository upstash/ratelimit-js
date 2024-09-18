import { expect, test, describe, afterAll, beforeAll } from "bun:test";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "../index";
import { checkDenyListCache, defaultDeniedResponse, resolveLimitPayload } from "./deny-list";
import type { DenyListResponse, RatelimitResponseType } from "../types";


test("should get expected response from defaultDeniedResponse", () => {
  const deniedValue = "testValue";
  const response = defaultDeniedResponse(deniedValue);

  expect(response).toEqual({
    success: false,
    limit: 0,
    remaining: 0,
    reset: 0,
    pending: expect.any(Promise),
    reason: "denyList",
    deniedValue: deniedValue
  });
});

describe("should resolve ratelimit and deny list response", async () => {
  const redis = Redis.fromEnv();
  const prefix = `test-resolve-prefix`;

  const initialResponse = {
    success: true,
    limit: 100,
    remaining: 50,
    reset: 60,
    pending: Promise.resolve(),
    reason: undefined,
    deniedValue: undefined
  };

  const expectedResponse = {
    success: false,
    limit: 100,
    remaining: 0,
    reset: 60,
    pending: Promise.resolve(),
    reason: "denyList" as RatelimitResponseType,
    deniedValue: "testValue"
  };

  test("should update ip deny list when invalidIpDenyList is true", async () => {
    let callCount = 0;
    const spyRedis = {
      multi: () => {
        callCount += 1;
        return redis.multi();
      }
    }

    const denyListResponse: DenyListResponse = {
      deniedValue: "testValue",
      invalidIpDenyList: true
    };

    const response = resolveLimitPayload(spyRedis as Redis, prefix, [initialResponse, denyListResponse], 8);
    await response.pending;

    expect(response).toEqual(expectedResponse);
    expect(callCount).toBe(1) // calls multi once to store ips
  });

  test("should update ip deny list when invalidIpDenyList is true", async () => {

    let callCount = 0;
    const spyRedis = {
      multi: () => {
        callCount += 1;
        return redis.multi();
      }
    }

    const denyListResponse: DenyListResponse = {
      deniedValue: "testValue",
      invalidIpDenyList: false
    };

    const response = resolveLimitPayload(spyRedis as Redis, prefix, [initialResponse, denyListResponse], 8);
    await response.pending;

    expect(response).toEqual(expectedResponse);
    expect(callCount).toBe(0) // doesn't call multi to update deny list
  });
})


describe("should reject in deny list", async () => {
  const redis = Redis.fromEnv();
  const prefix = `test-prefix`;
  const denyListKey = [prefix, "denyList", "all"].join(":");


  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(10, "5 s", 10),
    prefix,
    enableProtection: true,
    denyListThreshold: 8
  });

  afterAll(async () => {
    await redis.del(denyListKey)
  })

  // Insert a value into the deny list
  beforeAll(async () => {
    await redis.sadd(denyListKey, "denyIdentifier", "denyIp", "denyAgent", "denyCountry");
  })

  test("should allow with values not in the deny list", async () => {
    const { success, reason } = await ratelimit.limit("randomValue");

    expect(success).toBe(true);
    expect(reason).toBeUndefined();
  });

  test("should deny with identifier in the deny list", async () => {

    const { success, reason } = await ratelimit.limit("denyIdentifier");

    expect(success).toBe(false);
    expect(reason).toBe("denyList");

    const cacheCheck = checkDenyListCache(["denyIdentifier"]);
    expect(cacheCheck).toBe("denyIdentifier");
  });

  test("should deny with ip in the deny list", async () => {

    const { success, reason } = await ratelimit.limit("some-value", { ip: "denyIp" });

    expect(success).toBe(false);
    expect(reason).toBe("denyList");

    const cacheCheck = checkDenyListCache(["denyIp"]);
    expect(cacheCheck).toBe("denyIp");
  });

  test("should deny with user agent in the deny list", async () => {

    const { success, reason } = await ratelimit.limit("some-value", { userAgent: "denyAgent" });

    expect(success).toBe(false);
    expect(reason).toBe("denyList");

    const cacheCheck = checkDenyListCache(["denyAgent"]);
    expect(cacheCheck).toBe("denyAgent");
  });

  test("should deny with country in the deny list", async () => {

    const { success, reason } = await ratelimit.limit("some-value", { country: "denyCountry" });

    expect(success).toBe(false);
    expect(reason).toBe("denyList");

    const cacheCheck = checkDenyListCache(["denyCountry"]);
    expect(cacheCheck).toBe("denyCountry");
  });

  test("should deny with multiple in deny list", async () => {

    const { success, reason } = await ratelimit.limit("denyIdentifier", { country: "denyCountry" });

    expect(success).toBe(false);
    expect(reason).toBe("denyList");

    const cacheCheck = checkDenyListCache(["denyIdentifier"]);
    expect(cacheCheck).toBe("denyIdentifier");
  });
})
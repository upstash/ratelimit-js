import { Redis } from "@upstash/redis";
import { beforeEach, describe, expect, test } from "bun:test";
import { checkDenyList } from "./deny-list";
import { disableIpDenyList, updateIpDenyList } from "./ip-deny-list";
import { DenyListExtension, IpDenyListKey, IpDenyListStatusKey } from "../types";
import { Ratelimit } from "..";

describe("should update ip deny list status", async () => {
  const redis = Redis.fromEnv();
  const prefix = `test-ip-list-prefix`;
  const allDenyListsKey = [prefix, DenyListExtension, "all"].join(":");
  const ipDenyListsKey = [prefix, DenyListExtension, IpDenyListKey].join(":");
  const statusKey = [prefix, IpDenyListStatusKey].join(":")

  beforeEach(async () => {
    await redis.flushdb()
    await redis.sadd(
      allDenyListsKey, "foo", "bar")
  });

  test("should return invalidIpDenyList: true when empty", async () => {
    const { deniedValue, invalidIpDenyList } = await checkDenyList(
      redis, prefix, ["foo", "bar"]
    )

    expect(deniedValue).toBe("bar")
    expect(invalidIpDenyList).toBeTrue()
  })

  test("should return invalidIpDenyList: false when disabled", async () => {
    await disableIpDenyList(redis, prefix);
    const { deniedValue, invalidIpDenyList } = await checkDenyList(
      redis, prefix, ["bar", "foo"]
    )

    expect(deniedValue).toBe("foo")
    expect(invalidIpDenyList).toBeFalse()
  })

  test("should return invalidIpDenyList: false after updating", async () => {
    await updateIpDenyList(redis, prefix, 8);
    const { deniedValue, invalidIpDenyList } = await checkDenyList(
      redis, prefix, ["whale", "albatros"]
    )

    expect(typeof deniedValue).toBe("undefined")
    expect(invalidIpDenyList).toBeFalse()
  })

  test("should return invalidIpDenyList: false after updating + disabling", async () => {

    // initial values
    expect(await redis.ttl(statusKey)).toBe(-2)
    const initialStatus = await redis.get(statusKey)
    expect(initialStatus).toBe(null)

    // UPDATE
    await updateIpDenyList(redis, prefix, 8);
    const { deniedValue, invalidIpDenyList } = await checkDenyList(
      redis, prefix, ["user"]
    )

    expect(typeof deniedValue).toBe("undefined")
    expect(invalidIpDenyList).toBeFalse()
    // positive tll on the status key
    expect(await redis.ttl(statusKey)).toBeGreaterThan(0)
    const status = await redis.get(statusKey)
    expect(status).toBe("valid")

    // DISABLE
    await disableIpDenyList(redis, prefix);
    const {
      deniedValue: secondDeniedValue,
      invalidIpDenyList: secondInvalidIpDenyList
    } = await checkDenyList(
      redis, prefix, ["foo", "bar"]
    )

    expect(secondDeniedValue).toBe("bar")
    expect(secondInvalidIpDenyList).toBeFalse()
    // -1 in the status key
    expect(await redis.ttl(statusKey)).toBe(-1)
    const secondStatus = await redis.get(statusKey)
    expect(secondStatus).toBe("disabled")
  })

  test("should handle timeout correctly", async () => {

    await updateIpDenyList(redis, prefix, 8, 5000); // update with 5 seconds ttl on status flag
    const pipeline = redis.multi()
    pipeline.smembers(allDenyListsKey)
    pipeline.smembers(ipDenyListsKey)
    pipeline.get(statusKey)
    pipeline.ttl(statusKey)

    const [allValues, ipDenyListValues, status, statusTTL]: [string[], string[], string | null, number] = await pipeline.exec();
    expect(ipDenyListValues.length).toBeGreaterThan(0)
    expect(allValues.length).toBe(ipDenyListValues.length + 2) // + 2 for foo and bar
    expect(status).toBe("valid")
    expect(statusTTL).toBeGreaterThan(2) // ttl is more than 5 seconds

    // wait 6 seconds
    await new Promise((r) => setTimeout(r, 6000));

    const [newAllValues, newIpDenyListValues, newStatus, newStatusTTL]: [string[], string[], string | null, number] = await pipeline.exec();

    // deny lists remain as they are
    expect(newIpDenyListValues.length).toBeGreaterThan(0)
    expect(newAllValues.length).toBe(allValues.length)
    expect(newIpDenyListValues.length).toBe(ipDenyListValues.length)

    // status flag is gone
    expect(newStatus).toBe(null)
    expect(newStatusTTL).toBe(-2)
  }, { timeout: 10_000 })

  test("should overwrite disabled status with updateIpDenyList", async () => {
    await disableIpDenyList(redis, prefix);

    const pipeline = redis.multi()
    pipeline.smembers(allDenyListsKey)
    pipeline.smembers(ipDenyListsKey)
    pipeline.get(statusKey)
    pipeline.ttl(statusKey)

    const [allValues, ipDenyListValues, status, statusTTL]: [string[], string[], string | null, number] = await pipeline.exec();
    expect(ipDenyListValues.length).toBe(0)
    expect(allValues.length).toBe(2) // + 2 for foo and bar
    expect(status).toBe("disabled")
    expect(statusTTL).toBe(-1)

    // update status: called from UI or from SDK when status key expires
    await updateIpDenyList(redis, prefix, 8);

    const [newAllValues, newIpDenyListValues, newStatus, newStatusTTL]: [string[], string[], string | null, number] = await pipeline.exec();

    // deny lists remain as they are
    expect(newIpDenyListValues.length).toBeGreaterThan(0)
    expect(newAllValues.length).toBe(newIpDenyListValues.length + 2)
    expect(newStatus).toBe("valid")
    expect(newStatusTTL).toBeGreaterThan(1000)
  })
})

describe("should only allow threshold values from 1 to 8", async () => {
  const redis = Redis.fromEnv();
  const prefix = `test-ip-list-prefix`;

  test("should reject string", async () => {
    try {
      // @ts-expect-error test incorrect input
      await updateIpDenyList(redis, prefix, "test")
    } catch (error: any) {
      expect(error.name).toEqual("ThresholdError")
    }
  })

  test("should reject 0", async () => {
    try {
      await updateIpDenyList(redis, prefix, 0)
    } catch (error: any) {
      expect(error.name).toEqual("ThresholdError")
    }
  })

  test("should reject negative", async () => {
    try {
      await updateIpDenyList(redis, prefix, -1)
    } catch (error: any) {
      expect(error.name).toEqual("ThresholdError")
    }
  })

  test("should reject 9", async () => {
    try {
      await updateIpDenyList(redis, prefix, 9)
    } catch (error: any) {
      expect(error.name).toEqual("ThresholdError")
    }
  })

  test.only("should be able to use ratelimit with deny list", async () => {

    /**
     * When enableProtection is set to true, there was an error in the
     * @upstash/ratelimit 2.0.3 release. Because the @upstash/redis
     * uses auto-pipelining by default, the client would send the
     * EVALSHA and the protection EVAL at the same time.
     * 
     * When the db loses its scripts after a SCRIPT FLUSH or when
     * ratelimit is used in a new DB, the EVALSHA will fail. But
     * because since the EVAL and EVALSHA are pipelined, they will
     * both fail and EVAL will get the EVALSHA's error.
     */
    const redis = Redis.fromEnv({ enableAutoPipelining: true });

    // flush the db to make sure
    await redis.scriptFlush()
    // sleep for two secs
    await new Promise(r => setTimeout(r, 2000));

    const ratelimit = new Ratelimit({
      limiter: Ratelimit.fixedWindow(2, "1s"),
      redis,
      enableProtection: true
    })

    const { success, remaining } = await ratelimit.limit("ip-deny-list")
    expect(success).toBeTrue()
    expect(remaining).toBe(1)
  })
})

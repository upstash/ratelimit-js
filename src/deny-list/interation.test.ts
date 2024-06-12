// test ip deny list from the highest level, using Ratelimit
import { expect, test, describe, afterAll, beforeEach } from "bun:test";
import { Ratelimit } from "../index";
import { Redis } from "@upstash/redis";
import { DenyListExtension, IpDenyListKey, IpDenyListStatusKey, RatelimitResponse } from "../types";
import { disableIpDenyList } from "./ip-deny-list";

describe("should reject in deny list", async () => {
  
  const redis = Redis.fromEnv();
  const prefix = `test-integration-prefix`;
  const statusKey = [prefix, IpDenyListStatusKey].join(":")
  const allDenyListsKey = [prefix, DenyListExtension, "all"].join(":");
  const ipDenyListsKey = [prefix, DenyListExtension, IpDenyListKey].join(":");

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(10, "5 s", 10),
    prefix,
    enableProtection: true,
    denyListThreshold: 8
  });

  beforeEach(async () => {
    await redis.flushdb()
    await redis.sadd(allDenyListsKey, "foo");
  });

  test("should not check deny list when enableProtection: false", async () => {
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(10, "5 s", 10),
      prefix,
      enableProtection: false,
      denyListThreshold: 8
    });

    const result = await ratelimit.limit("foo")
    expect(result.success).toBeTrue()

    const [status, statusTTL, allSize, ipListsize] = await Promise.all([
      redis.get(statusKey),
      redis.ttl(statusKey),
      redis.scard(allDenyListsKey),
      redis.scard(ipDenyListsKey),
    ])

    // no status flag
    expect(status).toBe(null)
    expect(statusTTL).toBe(-2)
    expect(allSize).toBe(1) // foo
    expect(ipListsize).toBe(0)
  })

  test("should create ip denylist when enableProtection: true and not disabled", async () => {
    const { pending, success } =  await ratelimit.limit("foo");
    expect(success).toBeFalse()
    await pending;

    const [status, statusTTL, allSize, ipListsize] = await Promise.all([
      redis.get(statusKey),
      redis.ttl(statusKey),
      redis.scard(allDenyListsKey),
      redis.scard(ipDenyListsKey),
    ])

    // status flag exists and has ttl
    expect(status).toBe("valid")
    expect(statusTTL).toBeGreaterThan(1000)
    expect(allSize).toBeGreaterThan(0)
    expect(ipListsize).toBe(allSize-1) // foo
  })

  test("should not create ip denylist when enableProtection: true but flag is disabled", async () => {
    await disableIpDenyList(redis, prefix);
    const { pending, success } =  await ratelimit.limit("test-user-2");
    expect(success).toBeTrue()
    await pending;

    const [status, statusTTL, allSize, ipListsize] = await Promise.all([
      redis.get(statusKey),
      redis.ttl(statusKey),
      redis.scard(allDenyListsKey),
      redis.scard(ipDenyListsKey),
    ])

    // no status flag
    expect(status).toBe("disabled")
    expect(statusTTL).toBe(-1)
    expect(allSize).toBe(1) // foo
    expect(ipListsize).toBe(0)
  })

  test("should observe that ip denylist is deleted after disabling", async () => {
    const { pending, success } =  await ratelimit.limit("test-user-3");
    expect(success).toBeTrue()
    await pending;

    const [status, statusTTL, allSize, ipListsize] = await Promise.all([
      redis.get(statusKey),
      redis.ttl(statusKey),
      redis.scard(allDenyListsKey),
      redis.scard(ipDenyListsKey),
    ])

    // status flag exists and has ttl
    expect(status).toBe("valid")
    expect(statusTTL).toBeGreaterThan(1000)
    expect(allSize).toBeGreaterThan(0)
    expect(ipListsize).toBe(allSize-1) // foo

    // DISABLE: called from UI
    await disableIpDenyList(redis, prefix);

    // call again
    const { pending: newPending } =  await ratelimit.limit("test-user");
    await newPending;

    const [newStatus, newStatusTTL, newAllSize, newIpListsize] = await Promise.all([
      redis.get(statusKey),
      redis.ttl(statusKey),
      redis.scard(allDenyListsKey),
      redis.scard(ipDenyListsKey),
    ])

    // status flag exists and has ttl
    expect(newStatus).toBe("disabled")
    expect(newStatusTTL).toBe(-1)
    expect(newAllSize).toBe(1) // foo
    expect(newIpListsize).toBe(0)
  })

  test("should intialize ip list only once when called consecutively", async () => {

    const requests: RatelimitResponse[] = await Promise.all([
      ratelimit.limit("test-user-X"),
      ratelimit.limit("test-user-Y")
    ])

    expect(requests[0].success).toBeTrue()
    expect(requests[1].success).toBeTrue()

    // wait for both to finish
    const result = await Promise.all([
      requests[0].pending,
      requests[1].pending
    ])
    /**
     * Result is like this:
     * [
     *   undefined,
     *   [
     *     undefined,
     *     [ 1, 0, 74, 74, 75, "OK" ]
     *   ] 
     * ]
     * 
     * the first is essentially:
     * >> Promise.resolve()
     * 
     * Second one is
     * >> Promise.all([Promise.resolve(), updateIpDenyListPromise])
     * 
     * This means that even though the requests were consecutive, only one was
     * allowed to update to update the ip list!
     */

    // only one undefined
    expect(result.filter((value) => value === undefined).length).toBe(1)

    // other response is defined
    const definedResponse = result.filter((value) => value !== undefined)[0] as [undefined, any[]]
    expect(definedResponse[0]).toBe(undefined)
    expect(definedResponse[1].length).toBe(6)
    expect(definedResponse[1][1]).toBe(0) // deleting deny list fails because there is none
    expect(definedResponse[1][5]).toBe("OK") // setting TTL returns OK
  })

  test("should block ips from ip deny list", async () => {
    const { pending, success } =  await ratelimit.limit("test-user");
    expect(success).toBeTrue()
    await pending;

    const [ip1, ip2] = await redis.srandmember(ipDenyListsKey, 2) as string[]

    const result = await ratelimit.limit("test-user", {ip: ip1})
    expect(result.success).toBeFalse()
    expect(result.reason).toBe("denyList")

    await disableIpDenyList(redis, prefix);

    // first one still returns false because it is cached
    const newResult = await ratelimit.limit("test-user", {ip: ip1})
    expect(newResult.success).toBeFalse()
    expect(newResult.reason).toBe("denyList")

    // other one returns true
    const otherResult = await ratelimit.limit("test-user", {ip: ip2})
    expect(otherResult.success).toBeTrue()
  })
})
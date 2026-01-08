import { Redis } from "@upstash/redis";
import { describe, expect, test } from "bun:test";
import { Ratelimit } from "./index";

const redis = Redis.fromEnv();

describe("Dynamic Limits", () => {
  describe("Global Dynamic Limits", () => {
    test("should throw error if dynamicLimits is not enabled", async () => {
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "10 s"),
      });

      await expect(async () => {
        await ratelimit.setDynamicLimit({ limit: 100 });
      }).toThrow("dynamicLimits must be enabled");

      await expect(async () => {
        await ratelimit.getDynamicLimit();
      }).toThrow("dynamicLimits must be enabled");
    });

    test("should set and get global dynamic limit", async () => {
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1000 s"),
        prefix: `ratelimit-test-dynamic-${Date.now()}`,
        dynamicLimits: true,
      });

      // Initially should be null
      const initialLimit = await ratelimit.getDynamicLimit();
      expect(initialLimit).toBeNull();

      // Set dynamic limit
      await ratelimit.setDynamicLimit({ limit: 100 });

      // Should return the set limit
      const dynamicLimit = await ratelimit.getDynamicLimit();
      expect(dynamicLimit).toBe(100);
    });

    test("should use dynamic limit instead of default limit - fixedWindow", async () => {
      const prefix = `ratelimit-test-fixed-${Date.now()}`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(5, "1000 s"),
        prefix,
        dynamicLimits: true,
      });

      // Set dynamic limit to 3 (lower than default 5)
      await ratelimit.setDynamicLimit({ limit: 3 });

      const identifier = `test-${Date.now()}`;

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const { success, limit, remaining } = await ratelimit.limit(identifier);
        expect(success).toBe(true);
        expect(limit).toBe(3); // Should use dynamic limit
        expect(remaining).toBe(3 - (i + 1));
      }

      // 4th request should fail (dynamic limit is 3)
      const { success, limit, remaining } = await ratelimit.limit(identifier);
      expect(success).toBe(false);
      expect(limit).toBe(3);
      expect(remaining).toBe(0);
    });

    test("should use dynamic limit instead of default limit - slidingWindow", async () => {
      const prefix = `ratelimit-test-sliding-${Date.now()}`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1000 s"),
        prefix,
        dynamicLimits: true,
      });

      // Set dynamic limit to 2 (lower than default 5)
      await ratelimit.setDynamicLimit({ limit: 2 });

      const identifier = `test-${Date.now()}`;

      // First 2 requests should succeed
      for (let i = 0; i < 2; i++) {
        const { success, limit } = await ratelimit.limit(identifier);
        expect(success).toBe(true);
        expect(limit).toBe(2); // Should use dynamic limit
      }

      // 3rd request should fail (dynamic limit is 2)
      const { success, limit, remaining } = await ratelimit.limit(identifier);
      expect(success).toBe(false);
      expect(limit).toBe(2);
      expect(remaining).toBe(0);
    });

    test("should use dynamic limit instead of default limit - tokenBucket", async () => {
      const prefix = `ratelimit-test-bucket-${Date.now()}`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.tokenBucket(5, "1000 s", 10),
        prefix,
        dynamicLimits: true,
      });

      // Set dynamic limit to 3 (lower than default 10)
      await ratelimit.setDynamicLimit({ limit: 3 });

      const identifier = `test-${Date.now()}`;

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const { success, limit } = await ratelimit.limit(identifier);
        expect(success).toBe(true);
        expect(limit).toBe(3); // Should use dynamic limit
      }

      // 4th request should fail (dynamic limit is 3)
      const { success, limit, remaining } = await ratelimit.limit(identifier);
      expect(success).toBe(false);
      expect(limit).toBe(3);
      expect(remaining).toBe(0);
    });

    test("should update limit dynamically", async () => {
      const prefix = `ratelimit-test-update-${Date.now()}`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(10, "1000 s"),
        prefix,
        dynamicLimits: true,
        ephemeralCache: false,
      });

      const identifier = `test-${Date.now()}`;

      // Set initial dynamic limit to 2
      await ratelimit.setDynamicLimit({ limit: 2 });

      // Use up the 2 requests
      await ratelimit.limit(identifier);
      await ratelimit.limit(identifier);

      // Should be rate limited
      let result = await ratelimit.limit(identifier);
      expect(result.success).toBe(false);
      expect(result.limit).toBe(2);

      // Update dynamic limit to 5
      await ratelimit.setDynamicLimit({ limit: 5 });

      // Should now have more capacity
      result = await ratelimit.limit(identifier);
      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
    });

    test("should fall back to default limit when dynamic limit is not set", async () => {
      const prefix = `ratelimit-test-fallback-${Date.now()}`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(5, "1000 s"),
        prefix,
        dynamicLimits: true,
      });

      const identifier = `test-${Date.now()}`;

      // Should use default limit (5)
      for (let i = 0; i < 5; i++) {
        const { success, limit } = await ratelimit.limit(identifier);
        expect(success).toBe(true);
        expect(limit).toBe(5); // Should use default limit
      }

      // 6th request should fail
      const { success } = await ratelimit.limit(identifier);
      expect(success).toBe(false);
    });

    test("should work with getRemaining", async () => {
      const prefix = `ratelimit-test-remaining-${Date.now()}`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(10, "1000 s"),
        prefix,
        dynamicLimits: true,
      });

      // Set dynamic limit to 3
      await ratelimit.setDynamicLimit({ limit: 3 });

      const identifier = `test-${Date.now()}`;

      // Use 1 request
      await ratelimit.limit(identifier);

      // Check remaining - should use dynamic limit
      const { remaining } = await ratelimit.getRemaining(identifier);
      expect(remaining).toBe(2); // 3 - 1 = 2 (uses dynamic limit)
    });

    test("should work with cachedFixedWindow algorithm", async () => {
      const prefix = `ratelimit-test-cached-${Date.now()}`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(5, "1000 s"),
        prefix,
        dynamicLimits: true,
        ephemeralCache: false,
      });

      // Set dynamic limit to 2
      await ratelimit.setDynamicLimit({ limit: 2 });

      const identifier = `test-${Date.now()}`;

      // First 2 requests should succeed
      for (let i = 0; i < 2; i++) {
        const { success, limit } = await ratelimit.limit(identifier);
        expect(success).toBe(true);
        expect(limit).toBe(2);
      }

      // 3rd request should fail
      const { success, limit } = await ratelimit.limit(identifier);
      expect(success).toBe(false);
      expect(limit).toBe(2);
    });

    test("should disable dynamic limit and fall back to default", async () => {
      const prefix = `ratelimit-test-disable-${Date.now()}`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(5, "1000 s"),
        prefix,
        dynamicLimits: true,
        ephemeralCache: false,
      });

      const identifier = `test-${Date.now()}`;

      // Set dynamic limit to 2
      await ratelimit.setDynamicLimit({ limit: 2 });

      // Use up the 2 requests
      await ratelimit.limit(identifier);
      await ratelimit.limit(identifier);

      // Should be rate limited with limit 2
      let result = await ratelimit.limit(identifier);
      expect(result.success).toBe(false);
      expect(result.limit).toBe(2);

      // Disable dynamic limit
      await ratelimit.setDynamicLimit({ limit: false });

      // Verify it's been removed
      const dynamicLimit = await ratelimit.getDynamicLimit();
      expect(dynamicLimit).toBeNull();

      // Should now use default limit (5)
      result = await ratelimit.limit(identifier);
      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
    });
  });
});

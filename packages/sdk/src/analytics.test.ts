import { Redis } from "@upstash/redis";
import { Analytics } from "./analytics";
import { test, expect } from "@jest/globals";
import crypto from "node:crypto";

test("analytics", async () => {
  const redis = Redis.fromEnv();
  const a = new Analytics({ redis, prefix: crypto.randomUUID() });
  const time = Date.now();
  for (let i = 0; i < 20; i++) {
    await a.record({
      identifier: "id",
      success: true,
      time,
    });
  }

  const usage = await a.getUsage(Date.now() - 1000 * 60 * 60 * 24);
  expect(Object.entries(usage).length).toBe(1);
  expect(Object.keys(usage)).toContain("id");
  expect(usage["id"].success).toBe(20);
  expect(usage["id"].blocked).toBe(0);
});

import { Redis } from "@upstash/redis";
import { Analytics } from "./analytics";
import { test, expect } from "@jest/globals";
import crypto from "node:crypto";

test("analytics", async () => {
  const redis = Redis.fromEnv();
  const a = new Analytics({ redis, prefix: crypto.randomUUID() });

  for (let i = 0; i < 20; i++) {
    await a.record({
      identifier: "id",
      success: true,
      time: Date.now(),
    });
  }

  const events = await a.aggregate("identifier", Date.now() - 1000 * 60 * 60 * 24);
  expect(events.length).toBe(1);
});

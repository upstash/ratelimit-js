import { Redis } from "https://deno.land/x/upstash_redis@v1.19.3/mod.ts";
import { Analytics } from "./analytics.ts";
import { assertEquals } from "https://deno.land/std@0.174.0/testing/asserts.ts";

import { config } from "https://deno.land/x/dotenv@v3.2.0/mod.ts";

config({ export: true });

Deno.test({
  name: "analytics",
  fn: async (_t) => {
    const redis = Redis.fromEnv();
    const a = new Analytics({ redis, prefix: crypto.randomUUID() });

    for (let i = 0; i < 20; i++) {
      await a.record({
        identifier: "id",
        success: true,
        time: Date.now(),
      });
    }

    const events = await a.aggregate(
      "identifier",
      Date.now() - 1000 * 60 * 60 * 24,
    );
    assertEquals(events.length, 1);
  },
});

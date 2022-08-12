import type { Redis } from "./types.ts";
import { Ratelimit } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.152.0/testing/asserts.ts";

class RedisMock implements Redis {
  public readonly calls: Record<keyof Redis, number>;
  public responses: { eval: unknown; sadd: number };

  constructor(responses?: { eval: unknown; sadd: number }) {
    this.responses = responses ?? {} as { eval: unknown; sadd: number };
    this.calls = {
      eval: 0,
      sadd: 0,
    };
  }

  public async eval(
    _script: string,
    _keys: string[],
    _values: unknown[],
  ): Promise<unknown> {
    this.calls.eval++;
    return await Promise.resolve(this.responses.eval);
  }
  public async sadd(_key: string, ..._members: string[]): Promise<number> {
    this.calls.sadd++;
    return await Promise.resolve(this.responses.sadd);
  }
}

Deno.test({
  name: "ephermeral cache",
  fn: async (_t) => {
    const maxTokens = 10;
    const redis = new RedisMock();
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(maxTokens, "5 s", maxTokens),
      ephermeralCache: new Map(),
    });

    let passes = 0;

    for (let i = 0; i <= 20; i++) {
      redis.responses.eval = [maxTokens - i - 1, Date.now() + 1000];
      const { success } = await ratelimit.limit("id");
      if (success) {
        passes++;
      }
    }

    assertEquals(passes <= 10, true, "It should pass 10 times at most");
    assertEquals(
      redis.calls.eval <= 10,
      true,
      `It should not have called redis every single time, called: ${redis.calls.eval}`,
    );
  },
});

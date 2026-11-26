import { describe, expect, test } from "bun:test";
import { MultiRegionRatelimit } from "./multi";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("MultiRegionRatelimit.resetUsedTokens", () => {
  test("waits for the reset script to finish in every region", async () => {
    const first = deferred<unknown[]>();
    const second = deferred<unknown[]>();
    let firstCalls = 0;
    let secondCalls = 0;

    const firstRedis = {
      evalsha: () => {
        firstCalls += 1;
        return first.promise;
      },
    } as never;
    const secondRedis = {
      evalsha: () => {
        secondCalls += 1;
        return second.promise;
      },
    } as never;

    const ratelimit = new MultiRegionRatelimit({
      prefix: "multi-reset-test",
      redis: [firstRedis, secondRedis],
      limiter: MultiRegionRatelimit.fixedWindow(10, "10 s"),
      enableTelemetry: false,
    });

    let settled = false;
    const reset = ratelimit.resetUsedTokens("id").then(() => {
      settled = true;
    });

    // Give queued microtasks a chance to run. The reset must stay pending until
    // both regions finish deleting their keys; it must not settle early.
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(1);
    expect(settled).toBe(false);

    first.resolve([]);
    second.resolve([]);
    await reset;
    expect(settled).toBe(true);
  });
});

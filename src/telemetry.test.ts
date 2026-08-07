import { afterEach, describe, expect, test } from "bun:test";

import { MultiRegionRatelimit } from "./multi";
import { RegionRatelimit } from "./single";
import { addTelemetry } from "./telemetry";
import { VERSION } from "./version";

const createRedisMock = () => {
  const calls: { sdk?: string }[] = [];
  return {
    calls,
    client: {
      addTelemetry: (telemetry: { sdk?: string }) => {
        calls.push(telemetry);
      },
    },
  };
};

describe("addTelemetry", () => {
  afterEach(() => {
    delete process.env.UPSTASH_DISABLE_TELEMETRY;
  });

  test("sends the sdk name and version", () => {
    const { client, calls } = createRedisMock();
    addTelemetry(client);

    expect(calls).toEqual([{ sdk: `@upstash/ratelimit@${VERSION}` }]);
  });

  test("tags a client only once", () => {
    const { client, calls } = createRedisMock();
    addTelemetry(client);
    addTelemetry(client);

    expect(calls.length).toBe(1);
  });

  test("respects enableTelemetry: false", () => {
    const { client, calls } = createRedisMock();
    addTelemetry(client, false);

    expect(calls.length).toBe(0);
  });

  test("respects UPSTASH_DISABLE_TELEMETRY", () => {
    process.env.UPSTASH_DISABLE_TELEMETRY = "1";
    const { client, calls } = createRedisMock();
    addTelemetry(client);

    expect(calls.length).toBe(0);
  });

  test("does not throw on clients without addTelemetry", () => {
    expect(() => addTelemetry({})).not.toThrow();
    expect(() => addTelemetry(undefined)).not.toThrow();
  });

  test("does not throw when addTelemetry throws", () => {
    const client = {
      addTelemetry: () => {
        throw new Error("boom");
      },
    };

    expect(() => addTelemetry(client)).not.toThrow();
  });
});

describe("constructor wiring", () => {
  test("RegionRatelimit tags its redis client", () => {
    const { client, calls } = createRedisMock();
    new RegionRatelimit({
      redis: client as never,
      limiter: RegionRatelimit.slidingWindow(10, "10 s"),
    });

    expect(calls).toEqual([{ sdk: `@upstash/ratelimit@${VERSION}` }]);
  });

  test("RegionRatelimit respects enableTelemetry: false", () => {
    const { client, calls } = createRedisMock();
    new RegionRatelimit({
      redis: client as never,
      limiter: RegionRatelimit.slidingWindow(10, "10 s"),
      enableTelemetry: false,
    });

    expect(calls.length).toBe(0);
  });

  test("MultiRegionRatelimit tags every redis client once", () => {
    const first = createRedisMock();
    const second = createRedisMock();
    new MultiRegionRatelimit({
      redis: [first.client, second.client] as never,
      limiter: MultiRegionRatelimit.slidingWindow(10, "10 s"),
    });

    expect(first.calls).toEqual([{ sdk: `@upstash/ratelimit@${VERSION}` }]);
    expect(second.calls).toEqual([{ sdk: `@upstash/ratelimit@${VERSION}` }]);
  });

  test("MultiRegionRatelimit respects enableTelemetry: false", () => {
    const { client, calls } = createRedisMock();
    new MultiRegionRatelimit({
      redis: [client] as never,
      limiter: MultiRegionRatelimit.slidingWindow(10, "10 s"),
      enableTelemetry: false,
    });

    expect(calls.length).toBe(0);
  });
});

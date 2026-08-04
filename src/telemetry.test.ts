import { afterEach, describe, expect, test } from "bun:test";

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

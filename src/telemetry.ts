import { VERSION } from "./version";

/**
 * Minimal shape of the redis client we need for telemetry. `addTelemetry` is
 * `protected` in `@upstash/redis`, so it is not part of the public types.
 */
type TelemetryCapableRedis = {
  addTelemetry?: (telemetry: { sdk?: string; platform?: string; runtime?: string }) => void;
};

/**
 * The redis client appends to the telemetry header on every addTelemetry call,
 * so tag each client only once no matter how many Ratelimit instances are
 * created with it.
 */
const taggedClients = new WeakSet<object>();

const getSafeEnv = (): Record<string, string | undefined> =>
  typeof process === "object" && process && typeof process.env === "object" ? process.env : {};

/**
 * Reports the sdk name and version to Upstash through the redis client's
 * telemetry headers. The redis client itself already reports the platform and
 * the runtime, so we only append our own sdk tag, resulting in a header like
 * `@upstash/redis@1.35.0,@upstash/ratelimit@2.0.8`.
 *
 * Opt out with `enableTelemetry: false` in the Ratelimit config, with the same
 * option on the redis client, or with the `UPSTASH_DISABLE_TELEMETRY` env var.
 */
export const addTelemetry = (redis: unknown, enableTelemetry = true): void => {
  if (!enableTelemetry || getSafeEnv().UPSTASH_DISABLE_TELEMETRY) return;
  if (!redis || typeof redis !== "object") return;
  if (taggedClients.has(redis)) return;
  taggedClients.add(redis);

  try {
    const client = redis as TelemetryCapableRedis;
    // addTelemetry is intentionally hidden from the public types of @upstash/redis
    client.addTelemetry?.({ sdk: `@upstash/ratelimit@${VERSION}` });
  } catch {
    // telemetry must never break the client
  }
};

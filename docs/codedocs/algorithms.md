---
title: "Algorithms"
description: "How fixed window, sliding window, token bucket, and cached fixed window algorithms work internally."
---

Algorithms define how tokens are counted and when requests are allowed. In this library, algorithms are factory functions that return an object with `limit`, `getRemaining`, and `resetTokens` methods. The factories live in `src/single.ts` (single region) and `src/multi.ts` (multi region), and their Redis logic lives in `src/lua-scripts/`.

Each algorithm receives a `Context` with a Redis client, a key prefix, and optional cache. The algorithm then calls `safeEval` from `src/hash.ts`, which uses `EVALSHA` with a precomputed hash and falls back to `EVAL` if the script isn’t loaded.

```mermaid
flowchart TD
  A[limit(identifier)] --> B{Algorithm}
  B -->|fixedWindow| C[INCRBY + PEXPIRE]
  B -->|slidingWindow| D[GET current + GET previous]
  B -->|tokenBucket| E[HMGET refilledAt/tokens]
  C --> F[Compare against limit]
  D --> F
  E --> F
  F --> G[Return success/remaining/reset]
```

## Fixed window
Fixed window is implemented in `src/single.ts` with `SCRIPTS.singleRegion.fixedWindow.*` in `src/lua-scripts/single.ts`. It increments a counter for the current window and rejects when the counter exceeds the limit. The Lua script sets the key’s expiration the first time it is created so each bucket is self‑cleaning.

**Basic usage**
```ts title="app/ratelimit.ts"
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(100, "1 m")
});

const res = await ratelimit.limit("api_key_123");
```

**Advanced usage (dynamic limits)**
```ts title="app/dynamic.ts"
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(60, "1 m"),
  dynamicLimits: true
});

await ratelimit.setDynamicLimit({ limit: 120 });
const res = await ratelimit.limit("user_42");
```

## Sliding window
Sliding window blends current and previous windows to reduce boundary bursts. The Lua script reads both buckets, weights the previous window by how far into the current window you are, and then calculates remaining tokens. See `SCRIPTS.singleRegion.slidingWindow.*` in `src/lua-scripts/single.ts`.

**Basic usage**
```ts title="app/ratelimit.ts"
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s")
});
```

**Edge case (refunds)**
If you pass a negative `rate`, the algorithm treats it as a refund and skips cache blocking. This is handled in `src/single.ts` by checking `incrementBy > 0` before consulting the cache.

```ts title="app/refund.ts"
const res = await ratelimit.limit("order_77", { rate: -1 });
```

## Token bucket
Token bucket in `src/single.ts` uses a Redis hash to store `refilledAt` and `tokens`. The Lua script refills tokens based on elapsed time, then decrements by the request rate. See `tokenBucketLimitScript` in `src/lua-scripts/single.ts`.

**Basic usage**
```ts title="app/ratelimit.ts"
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.tokenBucket(5, "10 s", 20)
});
```

**Advanced usage (higher burst)**
```ts title="app/burst.ts"
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.tokenBucket(2, "1 s", 10)
});
```

## Cached fixed window
`cachedFixedWindow` is a special case that requires an ephemeral cache. It checks the local cache first, increments it optimistically, and updates Redis in the background. This is implemented in `src/single.ts` and uses `cachedFixedWindow*` scripts in `src/lua-scripts/single.ts`.

**Basic usage**
```ts title="app/worker.ts"
const cache = new Map();
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.cachedFixedWindow(5, "5 s"),
  ephemeralCache: cache
});
```

**Advanced usage (fail fast)**
```ts title="app/worker.ts"
try {
  const res = await ratelimit.limit("ip:10.0.0.1");
  if (!res.success) return new Response("blocked", { status: 429 });
} catch (error) {
  // cachedFixedWindow throws if no cache is provided
}
```

<Callout type="warn">`cachedFixedWindow` requires a cache (`ephemeralCache`). If you create the `Ratelimit` instance inside a request handler, the cache resets on every request and you lose the speed benefits. Create the instance outside your handler in serverless or edge functions.</Callout>

<Accordions>
<Accordion title="Fixed Window vs Sliding Window">
Fixed window is cheaper in Redis because it touches a single key per identifier, while sliding window reads two keys and applies a weighting step. That extra read means slightly higher latency, but it produces smoother limiting at window boundaries. If you expect burst traffic aligned to boundaries (cron jobs, marketing campaigns), sliding window reduces spikes. If cost and simplicity matter more than boundary behavior, fixed window is the pragmatic choice.
</Accordion>
<Accordion title="Token Bucket Trade-offs">
Token bucket provides steady throughput and allows bursts by setting `maxTokens` larger than the refill rate, which is excellent for user‑driven traffic. Internally it stores a hash per identifier and updates both `refilledAt` and `tokens`, so it is more stateful than fixed or sliding windows. If you refund tokens with a negative `rate`, the bucket can exceed the refill rate temporarily, which is useful for compensating failures. The trade-off is extra logic and a more complex reset behavior compared to time-bucketed counters.
</Accordion>
<Accordion title="Cached Fixed Window Caveats">
Cached fixed window removes Redis from the critical path on cache hits, which is ideal for hot identifiers in edge environments. However, because the cache is local, consistency is best‑effort and depends on the lifecycle of the runtime. If you run multiple isolates or regions, each has its own cache and can allow more requests than expected until Redis updates converge. Use it only when you can tolerate soft limits and you run in a single isolate or a small number of replicas.
</Accordion>
</Accordions>

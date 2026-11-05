---
title: "Ratelimit"
description: "Single-region rate limiter class exported as Ratelimit (RegionRatelimit)."
---

`Ratelimit` is the single‑region limiter exported from `src/single.ts` as `RegionRatelimit`. It extends the core `Ratelimit` base class in `src/ratelimit.ts` and uses a single Upstash Redis REST instance. It supports fixed window, sliding window, token bucket, and cached fixed window algorithms.

## Constructor
```ts title="src/single.ts"
new Ratelimit(config: RatelimitConfig)
```

**Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `redis` | `@upstash/redis` client | — | Redis REST client used for all operations. |
| `limiter` | `AlgorithmRegionContext>` | — | Algorithm factory, created with `Ratelimit.fixedWindow`, `slidingWindow`, `tokenBucket`, or `cachedFixedWindow`. |
| `prefix` | `string` | `@upstash/ratelimit` | Key prefix for Redis. |
| `ephemeralCache` | `Map<string, number> \| false` | auto Map | Local cache to short‑circuit blocked identifiers. Set to `false` to disable. |
| `timeout` | `number` | `5000` | Milliseconds to wait before returning a timeout response. |
| `analytics` | `boolean` | `false` | Enable analytics submission. |
| `enableProtection` | `boolean` | `false` | Enable deny list checks on identifier, IP, user agent, country. |
| `denyListThreshold` | `number` | `6` | Threshold for IP deny list updates. |
| `dynamicLimits` | `boolean` | `false` | Enable dynamic limit override stored in Redis. |

## Methods
### `limit`
```ts title="src/ratelimit.ts"
limit(identifier: string, req?: LimitOptions): PromiseRatelimitResponse>
```
- **Parameters**
  - `identifier`: identifier to rate limit (user ID, IP, API key).
  - `req.rate`: optional token rate (positive consumes, negative refunds).
  - `req.ip`, `req.userAgent`, `req.country`: used for deny list checks when protection is enabled.
- **Returns**: `RatelimitResponse` with `success`, `remaining`, `reset`, and `pending`.

**Example**
```ts title="app/api/route.ts"
const res = await ratelimit.limit("user_123", { rate: 1 });
if (!res.success) return new Response("blocked", { status: 429 });
```

### `blockUntilReady`
```ts title="src/ratelimit.ts"
blockUntilReady(identifier: string, timeout: number): PromiseRatelimitResponse>
```
Blocks until the request can pass or the timeout is reached.

**Example**
```ts title="app/queue.ts"
const res = await ratelimit.blockUntilReady("queue:item", 60_000);
```

### `getRemaining`
```ts title="src/ratelimit.ts"
getRemaining(identifier: string): Promise<{ remaining: number; reset: number; limit: number }>
```
Reads remaining tokens and reset timestamp without consuming tokens.

**Example**
```ts title="app/usage.ts"
const { remaining, reset } = await ratelimit.getRemaining("user_123");
```

### `resetUsedTokens`
```ts title="src/ratelimit.ts"
resetUsedTokens(identifier: string): Promise<void>
```
Deletes keys for the identifier to reset usage.

**Example**
```ts title="app/admin.ts"
await ratelimit.resetUsedTokens("user_123");
```

### `setDynamicLimit`
```ts title="src/ratelimit.ts"
setDynamicLimit(options: { limit: number | false }): Promise<void>
```
Overrides the default limit globally when `dynamicLimits` is enabled.

**Example**
```ts title="app/admin.ts"
await ratelimit.setDynamicLimit({ limit: 120 });
```

### `getDynamicLimit`
```ts title="src/ratelimit.ts"
getDynamicLimit(): Promise<{ dynamicLimit: number | null }>
```
Returns the current global dynamic limit.

## Static algorithm factories
### `fixedWindow`
```ts title="src/single.ts"
Ratelimit.fixedWindow(tokens: number, window: Duration): AlgorithmRegionContext>
```

### `slidingWindow`
```ts title="src/single.ts"
Ratelimit.slidingWindow(tokens: number, window: Duration): AlgorithmRegionContext>
```

### `tokenBucket`
```ts title="src/single.ts"
Ratelimit.tokenBucket(refillRate: number, interval: Duration, maxTokens: number): AlgorithmRegionContext>
```

### `cachedFixedWindow`
```ts title="src/single.ts"
Ratelimit.cachedFixedWindow(tokens: number, window: Duration): AlgorithmRegionContext>
```

**Related**
- [MultiRegionRatelimit](./multi-region-ratelimit)
- [Algorithms](../algorithms)

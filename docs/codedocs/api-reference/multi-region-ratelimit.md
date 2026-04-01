---
title: "MultiRegionRatelimit"
description: "Multi-region rate limiter with background synchronization and low-latency reads."
---

`MultiRegionRatelimit` in `src/multi.ts` extends the base `Ratelimit` class but uses an array of Redis REST clients (one per region). Each request is issued to every region, the first response wins, and synchronization runs asynchronously.

## Constructor
```ts title="src/multi.ts"
new MultiRegionRatelimit(config: MultiRegionRatelimitConfig)
```

**Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `redis` | `Redis[]` | — | Array of `@upstash/redis` clients, one per region. |
| `limiter` | `AlgorithmMultiRegionContext>` | — | Algorithm factory, typically `MultiRegionRatelimit.fixedWindow` or `slidingWindow`. |
| `prefix` | `string` | `@upstash/ratelimit` | Key prefix for Redis. |
| `ephemeralCache` | `Map<string, number> \| false` | auto Map | Optional local cache to short‑circuit blocked identifiers. |
| `timeout` | `number` | `5000` | Milliseconds to wait before returning a timeout response. |
| `analytics` | `boolean` | `false` | Enable analytics submission. |
| `dynamicLimits` | `boolean` | `false` | Not supported for multi‑region; ignored with a warning. |

## Methods
### `limit`
```ts title="src/ratelimit.ts"
limit(identifier: string, req?: LimitOptions): PromiseRatelimitResponse>
```
Behaves like the single‑region `limit`, but returns `pending` that includes synchronization across regions.

**Example**
```ts title="app/edge.ts"
const res = await ratelimit.limit("api_key_123");
context.waitUntil(res.pending);
```

### `blockUntilReady`
```ts title="src/ratelimit.ts"
blockUntilReady(identifier: string, timeout: number): PromiseRatelimitResponse>
```

### `getRemaining`
```ts title="src/ratelimit.ts"
getRemaining(identifier: string): Promise<{ remaining: number; reset: number; limit: number }>
```

### `resetUsedTokens`
```ts title="src/ratelimit.ts"
resetUsedTokens(identifier: string): Promise<void>
```

### `setDynamicLimit` and `getDynamicLimit`
These methods are inherited but not supported by multi‑region algorithms. If you enable `dynamicLimits` in the constructor you will receive a warning and the algorithms will ignore the dynamic limit key.

## Static algorithm factories
### `fixedWindow`
```ts title="src/multi.ts"
MultiRegionRatelimit.fixedWindow(tokens: number, window: Duration): AlgorithmMultiRegionContext>
```

### `slidingWindow`
```ts title="src/multi.ts"
MultiRegionRatelimit.slidingWindow(tokens: number, window: Duration): AlgorithmMultiRegionContext>
```

**Related**
- [Ratelimit](./ratelimit)
- [Multi-Region Consistency](../multi-region)

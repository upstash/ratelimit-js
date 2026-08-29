---
title: "Analytics"
description: "Analytics helper for recording and aggregating rate limit events."
---

`Analytics` in `src/analytics.ts` wraps `@upstash/core-analytics` and provides a higher‑level interface tailored to rate limit events. It is created automatically by `Ratelimit` when `analytics: true`, but you can also instantiate it directly for custom reporting.

## Constructor
```ts title="src/analytics.ts"
new Analytics(config: AnalyticsConfig)
```

**Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `redis` | `@upstash/redis` client | — | Redis REST client used for analytics storage. |
| `prefix` | `string` | `@upstash/ratelimit` | Namespace for analytics keys. |

## Methods
### `extractGeo`
```ts title="src/analytics.ts"
extractGeo(req: { geo?: Geo; cf?: Geo }): Geo
```
Extracts geo metadata from either `req.geo` (Vercel) or `req.cf` (Cloudflare). If neither is present, returns an empty object.

**Example**
```ts title="app/geo.ts"
const geo = analytics.extractGeo({ cf: { country: "US", city: "NYC" } });
```

### `record`
```ts title="src/analytics.ts"
record(event: Event): Promise<void>
```
Records a single event into the `events` table with identifier, time, success state, and optional geo data.

**Example**
```ts title="app/record.ts"
await analytics.record({
  identifier: "user_123",
  time: Date.now(),
  success: true,
  country: "US"
});
```

### `series`
```ts title="src/analytics.ts"
series(filter: TFilter, cutoff: number): PromiseAggregate[]>
```
Aggregates counts over time for a given field (e.g. identifier, country).

### `getUsage`
```ts title="src/analytics.ts"
getUsage(cutoff?: number): PromiseRecord<string, { success: number; blocked: number }>>
```
Returns allowed vs blocked counts grouped by identifier.

### `getUsageOverTime`
```ts title="src/analytics.ts"
getUsageOverTime(timestampCount: number, groupby: TFilter): PromiseAggregate[]>
```
Aggregates usage over time for a given field.

### `getMostAllowedBlocked`
```ts title="src/analytics.ts"
getMostAllowedBlocked(timestampCount: number, getTop?: number, checkAtMost?: number): PromiseAggregate[]>
```
Returns top identifiers by allowed/blocked counts.

## Usage with Ratelimit
If you enable analytics in `Ratelimit`, the library calls `analytics.record` after each request and attaches the work to the `pending` promise in the response.

```ts title="app/ratelimit.ts"
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true
});
```

**Related**
- [Request Lifecycle](../lifecycle)
- [Ratelimit](./ratelimit)

---
title: "Types"
description: "Exported TypeScript types and interfaces for configuring and extending the library."
---

This page lists the types exported from the package entrypoint `src/index.ts`. These are the types you can import directly from `@upstash/ratelimit`.

## `RatelimitConfig`
Exported from `src/single.ts` as `RegionRatelimitConfig`.

```ts title="src/single.ts"
export type RegionRatelimitConfig = {
  redis: Redis;
  limiter: AlgorithmRegionContext>;
  prefix?: string;
  ephemeralCache?: Map<string, number> | false;
  timeout?: number;
  analytics?: boolean;
  cacheScripts?: boolean; // deprecated
  enableProtection?: boolean;
  denyListThreshold?: number;
  dynamicLimits?: boolean;
};
```

Use this when constructing the single‑region `Ratelimit` class.

## `MultiRegionRatelimitConfig`
```ts title="src/multi.ts"
export type MultiRegionRatelimitConfig = {
  redis: Redis[];
  limiter: AlgorithmMultiRegionContext>;
  prefix?: string;
  ephemeralCache?: Map<string, number> | false;
  timeout?: number;
  analytics?: boolean;
  cacheScripts?: boolean;
  dynamicLimits?: boolean;
};
```

Use this when constructing `MultiRegionRatelimit`. Note that `dynamicLimits` is ignored for multi‑region limiters.

## `AnalyticsConfig`
```ts title="src/analytics.ts"
export type AnalyticsConfig = {
  redis: Redis;
  prefix?: string;
};
```

You can pass this to `new Analytics()` if you want custom analytics aggregation outside of `Ratelimit`.

## `Algorithm`
```ts title="src/types.ts"
export type AlgorithmTContext> = () => {
  limit: (ctx: TContext, identifier: string, rate?: number) => PromiseRatelimitResponse>;
  getRemaining: (ctx: TContext, identifier: string) => Promise<{ remaining: number; reset: number; limit: number }>;
  resetTokens: (ctx: TContext, identifier: string) => Promise<void>;
};
```

This is the shape returned by algorithm factories. It allows you to implement custom algorithms that plug into `Ratelimit` as long as they respect the same contract.

## `Duration`
```ts title="src/duration.ts"
export type Duration = `${number} ${"ms" | "s" | "m" | "h" | "d"}` | `${number}${"ms" | "s" | "m" | "h" | "d"}`;
```

Used by all algorithm factories to express window and interval sizes. Internally, `ms()` in `src/duration.ts` parses the string and converts it to milliseconds.

## Import examples
```ts title="app/types.ts"
import type { RatelimitConfig, MultiRegionRatelimitConfig, Duration, Algorithm } from "@upstash/ratelimit";
```

These types are useful when you wrap the library in your own abstractions. For example, if you build a shared `createRatelimit()` helper across multiple services, typing the config ensures you pass the correct Redis client and algorithm factory.

## Practical guidance
- Use `RatelimitConfig` for single‑region usage in serverless and edge environments.
- Use `MultiRegionRatelimitConfig` when you need lower latency across multiple regions and can tolerate eventual consistency.
- Use `Algorithm` only when you implement a custom algorithm; most users should rely on the built‑ins.
- Use `Duration` to keep window strings consistent and avoid invalid values (the parser throws on invalid formats).

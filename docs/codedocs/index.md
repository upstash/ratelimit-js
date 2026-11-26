---
title: "Getting Started"
description: "Upstash Rate Limit is a connectionless, HTTP-based rate limiting library for serverless, edge, and browser environments using Upstash Redis REST."
---

Upstash Rate Limit is a connectionless, HTTP-based rate limiting library for serverless, edge, and browser environments using Upstash Redis REST.

**The Problem**
- Traditional rate limiters assume long-lived TCP connections and don’t fit serverless or edge runtimes.
- You need predictable limits across multiple runtimes without deploying and operating your own Redis.
- Cold starts and network latency make per-request rate checks expensive without caching.
- You want optional analytics and protection (deny lists) without building extra pipelines.

**The Solution**
The library ships Redis-backed algorithms (fixed window, sliding window, token bucket, cached fixed window) and wraps them in a single `Ratelimit` API. It uses Upstash’s HTTP Redis to work in edge and serverless environments, adds an ephemeral cache to short‑circuit hot limits, and optionally records analytics or deny‑list decisions.

```ts title="app/ratelimit.ts"
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  prefix: "@upstash/ratelimit"
});
```

**Installation**
<Tabs items={["npm", "pnpm", "yarn", "bun"]}>
<Tab value="npm">
```bash
npm install @upstash/ratelimit @upstash/redis
```
</Tab>
<Tab value="pnpm">
```bash
pnpm add @upstash/ratelimit @upstash/redis
```
</Tab>
<Tab value="yarn">
```bash
yarn add @upstash/ratelimit @upstash/redis
```
</Tab>
<Tab value="bun">
```bash
bun add @upstash/ratelimit @upstash/redis
```
</Tab>
</Tabs>

**Quick Start**
```ts title="app/api/route.ts"
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(5, "10 s")
});

export async function GET() {
  const { success, remaining, reset } = await ratelimit.limit("user_123");
  if (!success) {
    return new Response("Too Many Requests", { status: 429 });
  }
  return new Response(`ok (remaining: ${remaining})`);
}
```

Expected output (first request):
```
ok (remaining: 4)
```

**Key Features**
- HTTP‑based Redis access for serverless, edge, browser, and WebAssembly environments
- Multiple algorithms with shared `Ratelimit` API
- Multi‑region support with background synchronization
- Optional analytics and protection (deny list)
- Ephemeral cache for faster blocking in hot runtimes
- Dynamic limits you can change at runtime

<Cards>
  <Card title="Architecture" href="/docs/architecture">How modules interact and why they are designed this way</Card>
  <Card title="Core Concepts" href="/docs/algorithms">Algorithms, lifecycle, protection, and multi‑region flows</Card>
  <Card title="API Reference" href="/docs/api-reference/ratelimit">Full API docs for Ratelimit and helpers</Card>
</Cards>

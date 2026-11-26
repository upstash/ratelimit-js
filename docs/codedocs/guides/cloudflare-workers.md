---
title: "Cloudflare Workers"
description: "Run rate limiting inside a Cloudflare Worker with an ephemeral cache and waitUntil."
---

This guide demonstrates a Worker that uses `cachedFixedWindow` with an ephemeral cache for fast blocking, and uses `context.waitUntil` to keep analytics and sync work alive.

<Steps>
<Step>
### Install dependencies
```bash
npm install @upstash/ratelimit @upstash/redis
```
</Step>
<Step>
### Bind environment variables
In `wrangler.toml` or the Cloudflare dashboard, set:
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```
</Step>
<Step>
### Worker implementation
```ts title="src/index.ts"
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

export interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

const cache = new Map();

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const ratelimit = new Ratelimit({
      redis: Redis.fromEnv(env),
      limiter: Ratelimit.cachedFixedWindow(5, "5 s"),
      ephemeralCache: cache,
      analytics: true
    });

    const res = await ratelimit.limit("identifier");
    context.waitUntil(res.pending);

    if (!res.success) {
      return new Response("Too Many Requests", { status: 429 });
    }
    return new Response(`ok (remaining: ${res.remaining})`);
  }
};
```
</Step>
</Steps>

**Why `cachedFixedWindow` here**
- Hot request bursts are rejected in memory without waiting for Redis.
- Redis is still updated to keep long‑term accounting correct.

**Complete runnable behavior**
- The first 5 requests per 5 seconds succeed.
- Additional requests return `429` until the window resets.

**When to use this pattern**
This is a good default for edge endpoints where you expect bursts and want minimal latency. Because the cache is per‑isolate, it is most accurate when your Worker runs in a small number of isolates. If you have many isolates, consider `slidingWindow` or `fixedWindow` for stricter global accounting.


<Callout type="warn">`cachedFixedWindow` throws if you forget to pass `ephemeralCache`. Always create the `Map` outside the handler so it survives across requests while the Worker stays hot.</Callout>

**Troubleshooting**
If `Redis.fromEnv(env)` fails, verify that the bindings are available in your Worker environment and that you are using the Cloudflare adapter from `@upstash/redis/cloudflare`. A missing adapter is the most common cause of runtime errors in Workers.

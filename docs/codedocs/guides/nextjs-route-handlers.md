---
title: "Next.js Route Handlers (Edge)"
description: "Use Ratelimit in a Next.js route handler running on the Edge runtime."
---

This guide shows how to enforce rate limits in a Next.js route handler deployed to the Edge runtime. It uses `waitUntil` to keep analytics submission alive after the response is sent.

<Steps>
<Step>
### Install dependencies
```bash
npm install @upstash/ratelimit @upstash/redis
```
</Step>
<Step>
### Configure environment variables
Set these in your Vercel project or `.env` file:
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```
</Step>
<Step>
### Add a route handler
```ts title="app/api/route.ts"
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { waitUntil } from "@vercel/functions";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true
});

export async function GET() {
  const { success, remaining, pending } = await ratelimit.limit("api");
  waitUntil(pending);

  if (!success) {
    return new Response("Too Many Requests", { status: 429 });
  }

  return new Response(`ok (remaining: ${remaining})`);
}
```
</Step>
</Steps>

**Why this works**
- `Ratelimit.slidingWindow` smooths boundary bursts with a weighted previous window.
- `pending` includes analytics submission; Edge runtimes cancel background work unless you attach it to `waitUntil`.

**Complete runnable behavior**
- First 10 requests in a 10‑second window return `200`.
- Subsequent requests return `429` until the window resets.

**Notes on identifiers**
Pick an identifier that matches your abuse surface. For public APIs, a stable API key or user ID is usually best. If you only have IPs, use a normalized IP string and be aware that shared NATs can cause unrelated users to share the same quota.


<Callout type="info">If you want strict enforcement even during network issues, increase or disable `timeout`. The default is 5 seconds in `src/ratelimit.ts`.</Callout>

**Troubleshooting**
If you always see `429`, verify that your identifier is not constant across users and that your deployment is not reusing the same identifier in tests. Also confirm that `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in the Edge environment.

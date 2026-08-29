---
title: "Enable Protection (Deny List)"
description: "Block abusive identifiers, IPs, or user agents with deny lists and protection mode."
---

Protection lets you automatically reject requests if the identifier or metadata appears in a deny list. This guide shows a minimal Next.js edge route handler that enables protection and passes request metadata to `limit()`.

<Steps>
<Step>
### Install dependencies
```bash
npm install @upstash/ratelimit @upstash/redis
```
</Step>
<Step>
### Configure environment variables
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```
</Step>
<Step>
### Add a protected route
```ts title="app/api/route.ts"
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { waitUntil } from "@vercel/functions";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  enableProtection: true
});

export async function POST(request: Request) {
  const body = await request.json();

  const res = await ratelimit.limit(body.userId, {
    ip: request.headers.get("x-forwarded-for") ?? "",
    userAgent: request.headers.get("user-agent") ?? "",
    country: request.headers.get("x-vercel-ip-country") ?? ""
  });

  waitUntil(res.pending);

  if (!res.success) {
    return new Response("Blocked", { status: 429 });
  }

  return new Response("ok");
}
```
</Step>
</Steps>

**Complete runnable behavior**
- If the user ID, IP, user agent, or country is in the deny list, the request is rejected with `reason: "denyList"`.
- Otherwise, the normal rate limit applies.

**Operational tips**
You can refresh the IP deny list manually using `IpDenyList.updateIpDenyList` when you rotate security policies or during incident response. Consider logging `res.reason` so you can differentiate between rate limit blocks and deny list blocks in your observability pipeline.


<Callout type="info">Protection uses deny list data from Redis and may apply cached decisions for up to 60 seconds. If you remove an entry from the deny list and need immediate unblocking, restart the runtime or disable the deny list cache.</Callout>

**Security note**
Protection is additive to rate limiting; it does not replace authentication or authorization. Use it to block known abusive identifiers and to reduce automated traffic while maintaining your normal access controls.

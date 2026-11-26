---
title: "Protection and Deny Lists"
description: "How deny lists work, how IP lists are synced, and how protection alters responses."
---

Protection adds a deny‑list layer on top of normal rate limiting. When enabled, `Ratelimit.limit` checks the identifier and request metadata (IP, user agent, country) against Redis‑stored deny lists. The logic lives in `src/deny-list/deny-list.ts`, while IP list updates are in `src/deny-list/ip-deny-list.ts`.

```mermaid
flowchart TD
  A[limit(identifier, options)] --> B[checkDenyListCache]
  B -->|hit| C[deny immediately]
  B -->|miss| D[Lua checkDenyListScript]
  D -->|denied| C
  D -->|not denied| E[Run algorithm]
  C --> F[Override response reason=denyList]
```

## How it works internally
- **Local cache**: `checkDenyListCache` uses an in‑memory `Cache` to block denied values for 60 seconds. This prevents repeated Redis checks for known‑bad identifiers.
- **Redis check**: `checkDenyList` runs `checkDenyListScript` (in `src/deny-list/scripts.ts`) which uses `SMISMEMBER` against a combined `all` set and checks the TTL of the IP deny list status key.
- **IP list refresh**: If the status TTL returns `-2` (expired), the script marks it as `pending`, and `resolveLimitPayload` schedules `updateIpDenyList` to refresh the list asynchronously.

## Basic usage
```ts title="app/api/route.ts"
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  enableProtection: true
});

const res = await ratelimit.limit("user_123", {
  ip: "203.0.113.42",
  userAgent: "my-app/1.0",
  country: "US"
});
```

## Advanced usage (manual IP list refresh)
```ts title="app/ops.ts"
import { IpDenyList } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
await IpDenyList.updateIpDenyList(redis, "@upstash/ratelimit", 6);
```

<Callout type="warn">Enabling protection adds Redis work to every request and may block based on IP, user agent, or country. If these values are unstable or missing (for example, mobile clients without a reliable IP), you can end up denying legitimate traffic. Consider limiting deny list checks to endpoints where you have consistent metadata.</Callout>

<Accordions>
<Accordion title="Automatic IP List Updates">
The IP deny list is sourced from a curated public list and refreshed when the status key expires. This keeps your list current without manual work, but it does introduce a dependency on external data availability. If the fetch fails, the update throws and the list is not refreshed, which can degrade protection quality. Use `updateIpDenyList` manually in ops workflows if you need deterministic updates.
</Accordion>
<Accordion title="Local Cache vs Global Lists">
The local deny list cache improves performance by avoiding repeated Redis lookups for recently denied values. However, it also means a value stays blocked for at least 60 seconds even if you remove it from Redis. This is usually acceptable for abuse control, but if you need immediate unblocking, you must restart the runtime or avoid the cache. The trade-off is performance versus immediacy.
</Accordion>
<Accordion title="Threshold Tuning">
The IP list uses a threshold from 1 to 8, where higher thresholds include only IPs that appear in more threat lists. Higher thresholds reduce false positives but may allow more suspicious traffic through. Lower thresholds block more aggressively but can impact legitimate users behind shared IPs or VPNs. Adjusting the threshold is a risk management decision that depends on the sensitivity of your application.
</Accordion>
</Accordions>

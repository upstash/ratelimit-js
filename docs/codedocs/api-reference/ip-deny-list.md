---
title: "IpDenyList"
description: "Helpers for managing the IP deny list and its refresh lifecycle."
---

`IpDenyList` is exported as a module (`export * as IpDenyList`) from `src/deny-list/ip-deny-list.ts`. It provides functions for refreshing and disabling the IP deny list stored in Redis. These helpers are primarily used internally when protection is enabled but can be called directly in operational workflows.

## Functions
### `updateIpDenyList`
```ts title="src/deny-list/ip-deny-list.ts"
updateIpDenyList(redis: Redis, prefix: string, threshold: number, ttl?: number): Promise<unknown>
```

**Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `redis` | `Redis` | — | Redis REST client. |
| `prefix` | `string` | — | Ratelimit key prefix (default is `@upstash/ratelimit`). |
| `threshold` | `number` | — | Allowed range 1–8. Higher means stricter IP inclusion. |
| `ttl` | `number` | computed | Optional TTL for the status key, otherwise time until next 2 AM UTC. |

**Behavior**
- Fetches a public IP list based on the `threshold` level.
- Removes the old IP list from the combined deny list set.
- Replaces the IP list set and makes it disjoint from custom deny list entries.
- Updates a status key with TTL for future refresh checks.

**Example**
```ts title="app/ops.ts"
import { IpDenyList } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
await IpDenyList.updateIpDenyList(redis, "@upstash/ratelimit", 6);
```

### `disableIpDenyList`
```ts title="src/deny-list/ip-deny-list.ts"
disableIpDenyList(redis: Redis, prefix: string): Promise<unknown>
```

**Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `redis` | `Redis` | — | Redis REST client. |
| `prefix` | `string` | — | Ratelimit key prefix. |

**Behavior**
- Removes the IP list set from the combined deny list.
- Deletes the IP list set.
- Sets the status key to `disabled` with no TTL.

**Example**
```ts title="app/ops.ts"
await IpDenyList.disableIpDenyList(redis, "@upstash/ratelimit");
```

## Errors
### `ThresholdError`
```ts title="src/deny-list/ip-deny-list.ts"
class ThresholdError extends Error
```
Thrown when `threshold` is outside the allowed range of 1–8.

**Related**
- [Protection and Deny Lists](../protection-denylist)
- [Ratelimit](./ratelimit)

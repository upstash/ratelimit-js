# Upstash Rate Limit

[![Tests](https://github.com/upstash/ratelimit/actions/workflows/tests.yaml/badge.svg)](https://github.com/upstash/ratelimit/actions/workflows/tests.yaml)
![npm (scoped)](https://img.shields.io/npm/v/@upstash/ratelimit)

> [!NOTE]
> **This project is in GA Stage.**
> The Upstash Professional Support fully covers this project. It receives regular updates, and bug fixes. The Upstash team is committed to maintaining and improving its functionality.

It is the only connectionless (HTTP based) rate limiting library and designed
for:

- Serverless functions (AWS Lambda, Vercel ....)
- Cloudflare Workers & Pages
- Vercel Edge
- Fastly Compute@Edge
- Next.js, Jamstack ...
- Client side web/mobile applications
- WebAssembly
- and other environments where HTTP is preferred over TCP.

## Quick Start

### Install

#### npm

```bash
npm install @upstash/ratelimit
```

#### Deno

```ts
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest"
```

### Create database

Create a new redis database on [upstash](https://console.upstash.com/)

### Basic Usage

See [here](https://github.com/upstash/upstash-redis#quick-start) for
documentation on how to create a redis instance.

```ts
import { Ratelimit } from "@upstash/ratelimit"; // for deno: see above
import { Redis } from "@upstash/redis"; // see below for cloudflare and fastly adapters

// Create a new ratelimiter, that allows 10 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  /**
   * Optional prefix for the keys used in redis. This is useful if you want to share a redis
   * instance with other applications and want to avoid key collisions. The default prefix is
   * "@upstash/ratelimit"
   */
  prefix: "@upstash/ratelimit",
});

// Use a constant string to limit all requests with a single ratelimit
// Or use a userID, apiKey or ip address for individual limits.
const identifier = "api";
const { success } = await ratelimit.limit(identifier);

if (!success) {
  return "Unable to process at this time";
}
doExpensiveCalculation();
return "Here you go!";
```

For Cloudflare Workers and Fastly Compute@Edge, you can use the following imports:

```ts
import { Redis } from "@upstash/redis/cloudflare"; // for cloudflare workers and pages
import { Redis } from "@upstash/redis/fastly"; // for fastly compute@edge
```

[Here's a complete nextjs example](https://github.com/upstash/ratelimit/tree/main/examples/nextjs)

The `limit` method returns some more metadata that might be useful to you:

````ts
export type RatelimitResponse = {
  /**
   * Whether the request may pass(true) or exceeded the limit(false)
   */
  success: boolean;
  /**
   * Maximum number of requests allowed within a window.
   */
  limit: number;
  /**
   * How many requests the user has left within the current window.
   */
  remaining: number;
  /**
   * Unix timestamp in milliseconds when the limits are reset.
   */
  reset: number;

  /**
   * For the MultiRegion setup we do some synchronizing in the background, after returning the current limit.
   * In most case you can simply ignore this.
   *
   * On Vercel Edge or Cloudflare workers, you need to explicitely handle the pending Promise like this:
   *
   * **Vercel Edge:**
   * https://nextjs.org/docs/api-reference/next/server#nextfetchevent
   *
   * ```ts
   * const { pending } = await ratelimit.limit("id")
   * event.waitUntil(pending)
   * ```
   *
   * **Cloudflare Worker:**
   * https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#syntax-module-worker
   *
   * ```ts
   * const { pending } = await ratelimit.limit("id")
   * context.waitUntil(pending)
   * ```
   */
  pending: Promise<unknown>;
};
````

### Docs
See [the documentation](https://upstash.com/docs/oss/sdks/ts/ratelimit/overview) for details.

## Contributing

### Database

Create a new redis database on [upstash](https://console.upstash.com/) and copy
the url and token.

### Running tests

```sh
UPSTASH_REDIS_REST_URL=".." UPSTASH_REDIS_REST_TOKEN=".." pnpm test
```

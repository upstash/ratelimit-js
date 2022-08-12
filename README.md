# Upstash RateLimit

[![Tests](https://github.com/upstash/ratelimit/actions/workflows/tests.yaml/badge.svg)](https://github.com/upstash/ratelimit/actions/workflows/tests.yaml)
![npm (scoped)](https://img.shields.io/npm/v/@upstash/ratelimit)

It is the only connectionless (HTTP based) rate limiting library and designed
for:

- Serverless functions (AWS Lambda ...)
- Cloudflare Workers
- Fastly Compute@Edge (see
- Next.js, Jamstack ...
- Client side web/mobile applications
- WebAssembly
- and other environments where HTTP is preferred over TCP.

<!-- toc -->

- [Docs](#docs)
- [Quick Start](#quick-start)
  - [Install](#install)
    - [npm](#npm)
    - [Deno](#deno)
  - [Create database](#create-database)
  - [Use it](#use-it)
  - [Block until ready](#block-until-ready)
  - [Ephemeral Cache](#ephemeral-cache)
- [MultiRegion replicated ratelimiting](#multiregion-replicated-ratelimiting)
  * [Ephemeral Cache](#ephemeral-cache)
- [MultiRegion replicated ratelimiting](#multiregion-replicated-ratelimiting-1)
  * [Usage](#usage)
  * [Asynchronous synchronization between databases](#asynchronous-synchronization-between-databases)
  * [Example](#example)
- [Ratelimiting algorithms](#ratelimiting-algorithms)
  * [Fixed Window](#fixed-window)
    + [Pros:](#pros)
    + [Cons:](#cons)
    + [Usage:](#usage)
  * [Sliding Window](#sliding-window)
    + [Pros:](#pros-1)
    + [Cons:](#cons-1)
    + [Usage:](#usage-1)
  * [Token Bucket](#token-bucket)
    + [Pros:](#pros-2)
    + [Cons:](#cons-2)
    + [Usage:](#usage-2)
- [Contributing](#contributing)
  * [Install Deno](#install-deno)
  * [Database](#database)
  * [Running tests](#running-tests)

<!-- tocstop -->

## Docs

[doc.deno.land](https://doc.deno.land/https://deno.land/x/upstash_ratelimit/src/mod.ts)

## Quick Start

### Install

#### npm

```bash
npm install @upstash/ratelimit
```

#### Deno

```ts
import { Ratelimit } from "https://deno.land/x/upstash_ratelimit/mod.ts";
```

### Create database

Create a new redis database on [upstash](https://console.upstash.com/)

### Use it

See [here](https://github.com/upstash/upstash-redis#quick-start) for
documentation on how to create a redis instance.

```ts
import { Ratelimit } from "@upstash/ratelimit"; // for deno: see above
import { Redis } from "@upstash/redis";

// Create a new ratelimiter, that allows 10 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
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

### Block until ready

In case you don't want to reject a request immediately but wait until it can be
processed, we also provide

```ts
ratelimit.blockUntilReady(identifier: string, timeout: number): Promise<RatelimitResponse>
```

It is very similar to the `limit` method and takes an identifier and returns the
same response. However if the current limit has already been exceeded, it will
automatically wait until the next window starts and will try again. Setting the
timeout parameter (in milliseconds) will cause the returned Promise to resolve
in a finite amount of time.

```ts
// Create a new ratelimiter, that allows 10 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

// `blockUntilReady` returns a promise that resolves as soon as the request is allowed to be processed, or after 30 seconds
const { success } = await ratelimit.blockUntilReady("id", 30_000);

if (!success) {
  return "Unable to process, even after 30 seconds";
}
doExpensiveCalculation();
return "Here you go!";
```

### Ephemeral Cache

For extreme load or denial of service attacks, it might be too expensive to call
redis for every incoming request, just to find out it should be blocked because
they have exceeded the limit.

You can use an ephemeral in memory cache by passing the `ephemeralCache` option:

```ts
const cache = new Map(); // must be outside of your serverless function handler

// ...

const ratelimit = new Ratelimit({
  // ...
  ephemeralCache: cache,
});
```

If enabled, the ratelimiter will keep a global cache of identifiers and their
reset timestamps, that have exhausted their ratelimit. In serverless
environments this is only possible if you create the cache or ratelimiter
instance outside of your handler function. While the function is still hot, the
ratelimiter can block requests without having to request data from redis, thus
saving time and money.

## MultiRegion replicated ratelimiting

Using a single redis instance has the downside of providing low latencies only
to the part of your userbase closest to the deployed db. That's why we also
built `MultiRegionRatelimit` which replicates the state across multiple redis
databases as well as offering lower latencies to more of your users.

`MultiRegionRatelimit` does this by checking the current limit in the closest db
and returning immediately. Only afterwards will the state be asynchronously
replicated to the other datbases leveraging
[CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type). Due
to the nature of distributed systems, there is no way to guarantee the set
ratelimit is not exceeded by a small margin. This is the tradeoff for reduced
global latency.

### Usage

The api is the same, except for asking for multiple redis instances:

```ts
import { MultiRegionRatelimit } from "@upstash/ratelimit"; // for deno: see above
import { Redis } from "@upstash/redis";

// Create a new ratelimiter, that allows 10 requests per 10 seconds
const ratelimit = new MultiRegionRatelimit({
  redis: [
    new Redis({
      /* auth */
    }),
    new Redis({
      /* auth */
    }),
    new Redis({
      /* auth */
    }),
  ],
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

// Use a constant string to limit all requests with a single ratelimit
// Or use a userID, apiKey or ip address for individual limits.
const identifier = "api";
const { success } = await ratelimit.limit(identifier);
```

### Asynchronous synchronization between databases

The MultiRegion setup will do some synchronization between databases after
returning the current limit. This can lead to problems on Cloudflare Workers and
therefore Vercel Edge functions, because dangling promises must be taken care
of:

**Vercel Edge:**
[docs](https://nextjs.org/docs/api-reference/next/server#nextfetchevent)

```ts
const { pending } = await ratelimit.limit("id");
event.waitUntil(pending);
```

**Cloudflare Worker:**
[docs](https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#syntax-module-worker)

```ts
const { pending } = await ratelimit.limit("id");
context.waitUntil(pending);
```

### Example

Let's assume you have customers in the US and Europe. In this case you can
create 2 regional redis databases on [Upstash](https://console.upstash.com) and
your users will enjoy the latency of whichever db is closest to them.

## Ratelimiting algorithms

We provide different algorithms to use out of the box. Each has pros and cons.

### Fixed Window

This algorithm divides time into fixed durations/windows. For example each
window is 10 seconds long. When a new request comes in, the current time is used
to determine the window and a counter is increased. If the counter is larger
than the set limit, the request is rejected.

#### Pros:

- Very cheap in terms of data size and computation
- Newer requests are not starved due to a high burst in the past

#### Cons:

- Can cause high bursts at the window boundaries to leak through
- Causes request stampedes if many users are trying to access your server,
  whenever a new window begins

#### Usage:

Create a new ratelimiter, that allows 10 requests per 10 seconds.

```ts
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, "10 s"),
});
```

### Sliding Window

Builds on top of fixed window but instead of a fixed window, we use a rolling
window. Take this example: We have a rate limit of 10 requests per 1 minute. We
divide time into 1 minute slices, just like in the fixed window algorithm.
Window 1 will be from 00:00:00 to 00:01:00 (HH:MM:SS). Let's assume it is
currently 00:01:15 and we have received 4 requests in the first window and 5
requests so far in the current window. The approximation to determine if the
request should pass works like this:

```ts
limit = 10

// 4 request from the old window, weighted + requests in current window
rate = 4 * ((60 - 15) / 60) + 5 = 8

return rate < limit // True means we should allow the request
```

#### Pros:

- Solves the issue near boundary from fixed window.

#### Cons:

- More expensive in terms of storage and computation
- Is only an approximation, because it assumes a uniform request flow in the
  previous window, but this is fine in most cases

#### Usage:

Create a new ratelimiter, that allows 10 requests per 10 seconds.

```ts
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

### Token Bucket

_Not yet supported for `MultiRegionRatelimit`_

Consider a bucket filled with `{maxTokens}` tokens that refills constantly at
`{refillRate}` per `{interval}`. Every request will remove one token from the
bucket and if there is no token to take, the request is rejected.

#### Pros:

- Bursts of requests are smoothed out and you can process them at a constant
  rate.
- Allows to set a higher initial burst limit by setting `maxTokens` higher than
  `refillRate`

#### Cons:

- Expensive in terms of computation

#### Usage:

Create a new bucket, that refills 5 tokens every 10 seconds and has a maximum
size of 10.

```ts
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.tokenBucket(5, "10 s", 10),
});
```

## Contributing

### [Install Deno](https://deno.land/#installation)

### Database

Create a new redis database on [upstash](https://console.upstash.com/) and copy
the url and token.

### Running tests

```sh
UPSTASH_REDIS_REST_URL=".." UPSTASH_REDIS_REST_TOKEN=".." deno test -A
```

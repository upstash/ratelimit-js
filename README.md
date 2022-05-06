# Upstash Redis

An HTTP/REST based Redis client built on top of Upstash REST API.
[Upstash REST API](https://docs.upstash.com/features/restapi).

[![Tests](https://github.com/upstash/ratelimit/actions/workflows/tests.yaml/badge.svg)](https://github.com/upstash/ratelimit/actions/workflows/tests.yaml)
![npm (scoped)](https://img.shields.io/npm/v/@upstash/ratelimit)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/@upstash/ratelimit)

It is the only connectionless (HTTP based) ratelimiter and designed for:

- Serverless functions (AWS Lambda ...)
- Cloudflare Workers
- Fastly Compute@Edge (see
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
import { Redis } from "https://deno.land/x/upstash_ratelimit/mod.ts";
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

```ts
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
};
```

### Block until ready

In case you don't want to reject a request immediately but wait until it can be processed, we also provide `ratelimit.blockUntilReady(identifier: stirng, timeout: number): Promise<RatelimitResponse>`

It is very similar to the `limit` method and takes an identifier and returns the same response. However if the current limit has already been exceeded, it will automatically wait until the next window starts and will try again. Setting the timeout parameter (in milliseconds) will cause the returned Promise to resolve in a finite amount of time.

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
dividie time into 1 minute slices, just like in the fixed window algorithm.
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

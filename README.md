# Node Redis Rate Limit

A fork of [@upstash/ratelimit](https://github.com/upstash/ratelimit) that uses Redis' `redis` package instead of Upstash's `@upstash/redis`. For Node.js/Bun/Deno serverful environments. Strips out Upstash specific features - analytics, deny list, etc.

## Quick Start

### Install

#### npm

```bash
npm install @linklet-io/node-redis-ratelimit
```

### Basic Usage

```ts
import { Ratelimit } from "@linklet-io/node-redis-ratelimit";
import { createClient } from "redis";

// Create a new ratelimiter, that allows 10 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: createClient(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  /**
   * Optional prefix for the keys used in redis. This is useful if you want to share a redis
   * instance with other applications and want to avoid key collisions. The default prefix is
   * "@linklet-io/node-redis-ratelimit-js"
   */
  prefix: "@linklet-io/node-redis-ratelimit-js",
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

For more information on getting started, you can refer to [our documentation](https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted).

[Here's a complete nextjs example](https://github.com/upstash/ratelimit/tree/main/examples/nextjs)

## Documentation

See [the documentation](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) for more information details about this package.

## Contributing

### Database

Create a new redis database on [upstash](https://console.upstash.com/) and copy
the url and token.

### Running tests

To run the tests, you will need to have a redis instance. Example using docker:

```sh
docker run -p 6379:6379 -it redis/redis-stack-server:latest
```

Once you have a redis instance, simply run:

```sh
pnpm test
```

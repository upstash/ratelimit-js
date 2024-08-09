# Upstash Rate Limit

[![npm (scoped)](https://img.shields.io/npm/v/@upstash/ratelimit)](https://www.npmjs.com/package/@upstash/ratelimit)
[![Tests](https://github.com/upstash/ratelimit/actions/workflows/tests.yaml/badge.svg)](https://github.com/upstash/ratelimit/actions/workflows/tests.yaml)

> [!NOTE]
>  **This project is in GA Stage.**
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
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
```

### Create database

Create a new redis database on [upstash](https://console.upstash.com/). See [here](https://github.com/upstash/upstash-redis#quick-start) for documentation on how to create a redis instance.

### Basic Usage

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

For more information on getting started, you can refer to [our documentation](https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted).

[Here's a complete nextjs example](https://github.com/upstash/ratelimit/tree/main/examples/nextjs)

## Documentation

See [the documentation](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) for more information details about this package.

## Contributing

### Database

Create a new redis database on [upstash](https://console.upstash.com/) and copy
the url and token.

### Running tests

To run the tests, you will need to set some environment variables. Here is a list of
variables to set:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `US1_UPSTASH_REDIS_REST_URL`
- `US1_UPSTASH_REDIS_REST_TOKEN`
- `APN_UPSTASH_REDIS_REST_URL`
- `APN_UPSTASH_REDIS_REST_TOKEN`
- `EU2_UPSTASH_REDIS_REST_URL`
- `EU2_UPSTASH_REDIS_REST_TOKEN`

You can create a single Upstash Redis and use its URL and token for all four above.

Once you set the environment variables, simply run:
```sh
pnpm test
```

# Nextjs Example with Middleware

In this example, we set up rate limiting for an API endpoint in a Nextjs project using the middleware.

We define two api endpoints `/api` and `api/blocked`. First one simply returns `Voila!` while the second one returns `Rate Limited!` with status 429. In the middleware, we initialize a Ratelimit and use it to rate limit requests made to `/api` endpoint. If the request is rate limited, we redirect to the `api/blocked` endpoint:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, "10s"),
  ephemeralCache: new Map(),
  prefix: "@upstash/ratelimit",
  analytics: true,
});

export default async function middleware(
  request: NextRequest,
  context: NextFetchEvent,
): Promise<Response | undefined> {
  const ip = request.ip ?? "127.0.0.1";

  const { success, pending, limit, remaining } = await ratelimit.limit(ip);
  // we use context.waitUntil since analytics: true.
  // see https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted#serverless-environments
  context.waitUntil(pending);

  const res = success
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/api/blocked", request.url));

    res.headers.set("X-RateLimit-Success", success.toString());
    res.headers.set("X-RateLimit-Limit", limit.toString());
    res.headers.set("X-RateLimit-Remaining", remaining.toString());

  return res;
}

export const config = {
  matcher: "/api",
};
```

# Run locally

To run the example in your local environment, create a Upstash Redis and set the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. Then run

```bash
npm run dev
```

# Deploy to Vercel

To deploy the project, install [Vercel CLI](https://vercel.com/docs/cli), set the environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on Vercel and run:

```bash
vercel deploy
```
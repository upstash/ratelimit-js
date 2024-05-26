# Nextjs Example

In this example, we set up rate limiting for an API endpoint in a Nextjs project.

We define the api in [`route.ts`](https://github.com/upstash/ratelimit/blob/main/examples/nextjs/app/api/route.ts), at `/api/route` route. We rate limit the requests using Upstash Ratelimit:

```ts
export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

import { waitUntil } from '@vercel/functions';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create a new ratelimiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
  analytics: true
});

export async function GET(request: Request) {

  const identifier = "api";
  const { success, limit, remaining, pending } = await ratelimit.limit(identifier);
  const response = {
    success: success,
    limit: limit, 
    remaining: remaining
  }

  // pending is a promise for handling the analytics submission
  waitUntil(pending)
    
  if (!success) {
    return new Response(JSON.stringify(response), { status: 429 });
  }
  return new Response(JSON.stringify(response));
}
```

The `redis` parameter denotes the Upstash Redis instance we use. The `limiter` parameter denotes the algorithm used to limit requests. The `prefix` parameter is used when creating a key for entries in the Redis, allowing us to use a single Redis instance for different rate limiters. The `analytics` parameter denotes whether analytics will we sent to the Redis in order to use the Upstash Analytics dashboard.

To limit the requests, we call `ratelimit.limit` method with an identifier `"api"`. This identifier could be the ip address or the user id in your use case. See [our documentation](https://upstash.com/docs/oss/sdks/ts/ratelimit/methods#limit) for more information.

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
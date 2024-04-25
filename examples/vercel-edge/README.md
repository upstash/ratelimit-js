# Rate Limiting a Vercel Edge API

In this example, we define an API using Vercel Edge and utilize
rate limiting to protect it.

The api is defined in [the route.ts file](https://github.com/upstash/ratelimit/blob/main/examples/vercel-edge/app/api/route.ts) as follows:

```ts
export const runtime = 'edge';

export const dynamic = 'force-dynamic';

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create a new ratelimiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
});

export async function GET(request: Request) {

  const identifier = "api";
  const { success, limit, remaining } = await ratelimit.limit(identifier);
  const response = {
    success: success,
    limit: limit, 
    remaining: remaining
  }
    
  if (!success) {
    return new Response(JSON.stringify(response), { status: 429 });
  }
  return new Response(JSON.stringify(response));
}
```

It runs on Vercel Edge and upon request, it returns the result of the rate limit call. This response is then shown on the home page.

# Run Locally

To run the example in your local environment, create a Upstash Redis and set the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. Then run

```
npm run dev
```

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

# Analytics and Multi-Region

Enablinng analytics or multi region rate limiting requires us to use the
`pending` field and wait for it before the edge environment terminates.
The issue with pending is we need to wait for it with `context.waitUntil(pending)` but this is not available in Vercel Edge at the time of the
writing of this example. See
[Upstash Documentation](https://upstash.com/docs/oss/sdks/ts/ratelimit/gettingstarted#serverless-environments)
and [related issue in nextjs](https://github.com/vercel/next.js/issues/50522)
for more details.

If you wish to use analytics or multi-region ratelimiting, you can use the middleware. For more details, see [the Ratelimit nextjs-middleware example](https://github.com/upstash/ratelimit/blob/main/examples/nextjs-middleware).

# Run Locally

To run the example in your local environment, create a Upstash Redis and set the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. Then run

```
npm run dev
```

# Deploy to Vercel

To deploy the project, install [Vercel CLI](https://vercel.com/docs/cli), set the environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on Vercel and run:

```bash
vercel deploy
```

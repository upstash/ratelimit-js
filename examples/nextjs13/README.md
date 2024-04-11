# Nextjs Example with App Router

In this example, we add rate limiting to a webpage in a Nextjs project with App router.

First, we define a rate limiter in the route.tsx file:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  analytics: true,
  limiter: Ratelimit.slidingWindow(2, "5s"),
});
```

We use Upstash Redis, enable anayltics and use sliding window algorithm with 2 request per 5 seconds.

Then, we define the `GET` method:

```ts
export async function GET(req: NextRequest) {
  const id = req.ip ?? "anonymous";
  const limit = await ratelimit.limit(id ?? "anonymous");
  await limit.pending;  // wait for analytics submission to finish
  return NextResponse.json(limit, { status: limit.success ? 200 : 429 });
}
```

# Run locally

To run the example in your local environment, create a Upstash Redis and set the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. Then run

```
npm run dev
```

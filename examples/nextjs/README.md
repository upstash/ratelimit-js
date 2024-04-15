# Nextjs Example with Pages Router & Middleware

In this example, we set up rate limiting for an API endpoint in a Nextjs project with Pages router. We set up the rate limiting in the [middleware](https://github.com/upstash/ratelimit/blob/main/examples/nextjs/middleware.ts).

We define the api in [`hello.ts`](https://github.com/upstash/ratelimit/blob/main/examples/nextjs/pages/api/hello.ts), at `api/hello` route.

Then we [match the api route in the middleware](https://github.com/upstash/ratelimit/blob/main/examples/nextjs/middleware.ts#L33) so that requests to this api endpoint go through our middleware:

```ts
export const config = {
  matcher: "/api/hello",
};
```

Additionally, we [define the rate limit](https://github.com/upstash/ratelimit/blob/main/examples/nextjs/middleware.ts#L5) in the middleware file, but outside the `middleware` method:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.cachedFixedWindow(10, "10s"),
  ephemeralCache: new Map(),
  analytics: true,
});
```

The `redis` parameter denotes the Upstash Redis instance we use. The `limiter` parameter denotes the algorithm used to limit requests. In this case, we use a `cachedFixedWindow` which is currently an experimental algorithm in development. It uses a local cache to rate limit requests and updates the redis instace asynchronously. The `ephemeralCache` parameter denotes the local cache instace. The `analytics` parameter denotes whether analytics will we sent to the Redis in order to use the Upstash Analytics dashboard.

Finally, we add the middleware method:

```ts
export default async function middleware(
  request: NextRequest,
  context: NextFetchEvent,
): Promise<Response | undefined> {
  const ip = request.ip ?? "127.0.0.1";

  const { success, pending, limit, reset, remaining } = await ratelimit.limit(
    `ratelimit_middleware_${ip}`,
  );
  context.waitUntil(pending);

  const res = success
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/api/blocked", request.url));

  res.headers.set("X-RateLimit-Limit", limit.toString());
  res.headers.set("X-RateLimit-Remaining", remaining.toString());
  res.headers.set("X-RateLimit-Reset", reset.toString());
  return res;
}
```

In the middleware method, we first fetch the ip address of the request. Then, we create an identifier from the ip address with `ratelimit_middleware_${ip}` and pass it to the `limit` method. Then, we call `context.waitUntil(pending)` ([see Vercel docs](https://vercel.com/docs/functions/edge-middleware/middleware-api#waituntil)). The reason why we wait for `pending` in this case is that the middleware is handled in an environment like Vercel Edge and our middleware can terminate before the analytics are submitted since analytics are sent asynchronously. In order to ensure that they are sent correctly, we must wait.

# Run locally

To run the example in your local environment, create a Upstash Redis and set the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. Then run

```
npm run dev
```

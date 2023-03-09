# @upstash/ratelimit in Remix

This example shows how to use `@upstash/ratelimit` in a Remix app.

## Getting Started

Create a database on [Upstash](https://console.upstash.com/redis?new=true) and copy the `Upstash_REDIS_REST_URL` and `Upstash_REDIS_REST_TOKEN` from the database settings to your `.env` file.

Then add a `loader` to your route like this:

```tsx
import { json } from "@remix-run/node";
import type { LoaderArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, "60 s"),
  analytics: true,
});

export const loader = async (args: LoaderArgs) => {
  // getting the ip can be different depending on your hosting provider
  const ip = args.request.headers.get("X-Forwarded-For") ?? args.request.headers.get("x-real-ip");
  const identifier = ip ?? "global";
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);
  return json(
    {
      success,
      limit,
      remaining,
      reset,
      identifier,
    },
    {
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    },
  );
};

export default function Index() {
  const ratelimitResponse = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
      <h1>Welcome to @upstash/ratelimit in Remix app</h1>
      <code>
        <pre>{JSON.stringify(ratelimitResponse, null, 2)}</pre>
      </code>
    </div>
  );
}
```
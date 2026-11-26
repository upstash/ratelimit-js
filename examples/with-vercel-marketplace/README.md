# Ratelimit with Upstash Redis from the Vercel Marketplace

This Next.js example rate limits a page with `@upstash/ratelimit`, using an
Upstash Redis database created through the
[Upstash integration on the Vercel Marketplace](https://vercel.com/marketplace/upstash).
Vercel KV stores now run on Upstash Redis, and `@vercel/kv` is deprecated, so the
example uses [`@upstash/redis`](https://github.com/upstash/redis-js) directly.

The ratelimiter lives in [`app/page.tsx`](./app/page.tsx):

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, "30s"),
});
```

## Getting Started

1. Create an Upstash Redis database, either from the
   [Upstash Console](https://console.upstash.com) or by adding the Upstash
   integration to your Vercel project.
2. Set the environment variables. `Redis.fromEnv()` reads
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables that the Vercel
   integration sets, so existing Vercel KV projects need no change. For local
   development, pull them with `vercel env pull .env.local` or put them in
   `.env.local` yourself.
3. Install the dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and refresh the page more
than 10 times within 30 seconds to see the limit kick in.

## Learn More

- [Upstash Ratelimit documentation](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Upstash Redis documentation](https://upstash.com/docs/redis/overall/getstarted)

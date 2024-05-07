This is a [Next.js](https://nextjs.org/) project bootstrapped with [`c3`](https://developers.cloudflare.com/pages/get-started/c3) which examplifies how one can use Upstash Ratelimit with Cloudflare Pages.

The project was initialized with ([see CF guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-nextjs-site/)):

```bash
npm create cloudflare@latest cloudflare-pages -- --framework=next
```

Then, the [page.tsx](https://github.com/upstash/ratelimit/blob/main/examples/cloudflare-pages/app/page.tsx) file was updated with a simple page to test ratelimiting. An api endpoint was added in [route.tsx](https://github.com/upstash/ratelimit/blob/main/examples/cloudflare-pages/app/api/route.tsx). This is where we define the rate limit like the following:

```tsx
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

## Getting Started

First, create an Upstash Redis through [the Upstash console](https://console.upstash.com/redis) and set the environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

To deploy the project, simply set the environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` through the Environment Variables section under the Settings tab on [the Cloudflare Dashboard](https://dash.cloudflare.com). Then, run:

```bash
npm run deploy
```

Note: if you don't set the environment variables, you may get an error when deploying the project.
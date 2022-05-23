import type { NextFetchEvent, NextRequest } from "next/server";
import { MultiRegionRatelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
): Promise<Response | undefined> {
  const start = Date.now();
  const ratelimit = new MultiRegionRatelimit({
    redis: [
      new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL_FRA!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN_FRA!,
      }),
      new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL_IOWA!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN_IOWA!,
      }),
    ],
    limiter: MultiRegionRatelimit.fixedWindow(10, "10 s"),
  });

  const ip = request.ip ?? "127.0.0.1";

  const { success, pending, limit, reset, remaining } = await ratelimit.limit(
    `mw_${ip}`,
  );
  event.waitUntil(pending);
  console.log("Middleware", success);
  return new Response(
    JSON.stringify({ success, latency: Date.now() - start, ip }),
    {
      status: success ? 200 : 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    },
  );
}

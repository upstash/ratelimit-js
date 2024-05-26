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
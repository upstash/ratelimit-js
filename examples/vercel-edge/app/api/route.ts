export const runtime = 'edge';

export const dynamic = 'force-dynamic';

import { Ratelimit } from "@upstash/ratelimit";

import { Redis } from "@upstash/redis";

// Create a new ratelimiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(1, "10 s"),
  prefix: "@upstash/ratelimit",
  // analytics not enabled. See README for more details about analytics and Vercel Edge.
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
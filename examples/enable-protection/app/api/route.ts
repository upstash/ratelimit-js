export const runtime = 'edge';

export const dynamic = 'force-dynamic';

import { waitUntil } from '@vercel/functions';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create a new ratelimiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
  analytics: true,
  enableProtection: true
});

export async function POST(request: Request) {

  const content = await request.json()
  
  const { success, limit, remaining, pending, reason } = await ratelimit.limit(
    content, {ip: "10"});
  const response = {
    success: success,
    limit: limit, 
    remaining: remaining
  }
  console.log(success, reason)

  // pending is a promise for handling the analytics submission
  waitUntil(pending)
    
  if (!success) {
    return new Response(JSON.stringify(response), { status: 429 });
  }
  return new Response(JSON.stringify(response));
}
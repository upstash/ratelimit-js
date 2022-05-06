/* global Request */

import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export default async function middleware(_request: Request) {
  const r = await ratelimit.limit("api");
  if (!r.success) {
    return new Response("Blocked", { status: 429 });
  }
  const value = await redis.incr("middleware_counter_ratelimited");
  console.log({ value });
  return NextResponse.next();
}

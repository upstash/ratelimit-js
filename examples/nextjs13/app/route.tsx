import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  analytics: true,
  limiter: Ratelimit.slidingWindow(2, "5s"),
});
export async function GET(req: NextRequest) {
  const id = req.ip ?? "anonymous";
  const limit = await ratelimit.limit(id ?? "anonymous");
  return NextResponse.json(limit, { status: limit.success ? 200 : 429 });
}

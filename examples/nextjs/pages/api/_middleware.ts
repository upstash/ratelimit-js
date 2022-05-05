import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.tokenBucket("10 s", 10, 10),
});
export default async function middleware(request: Request) {
  // chose any name to use one ratelimit for all requests
  const { success } = await ratelimit.limit("api");
  if (!success) {
    return new Response("Ratelimit reached", { status: 429 });
  }
  return NextResponse.next();
}
 w    .-    

 
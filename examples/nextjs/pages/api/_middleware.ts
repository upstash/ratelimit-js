import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { MultiRegionRatelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
export default async function middleware(
  _request: NextRequest,
  event: NextFetchEvent,
): Promise<Response | undefined> {
  const ratelimit = new MultiRegionRatelimit({
    redis: [
      new Redis({
        url: "https://eu2-funny-slug-30130.upstash.io",
        token:
          "AXWyASQgNjhlYWZlZmYtZjE3ZC00ZTc3LWJiOWEtMGVmZjFhYjgyNDdjYmU2ZjEwNDQ4YjYxNGY0M2JjNmU3OWVhNGFkNmQ5ODY=",
      }),
      new Redis({
        url: "https://apn1-charming-orca-33033.upstash.io",
        token:
          "AYEJASQgMDk3NzkyOGUtMDdkNS00ZWE2LWFmMDItYmYxNWIyNDI1ZWY1YmU4YWU5NGI5ZDViNDhmMDg1YTVlY2I1YTk5ZjQ1ZTc=",
      }),
      new Redis({
        url: "https://us1-close-crab-37047.upstash.io",
        token:
          "AZC3ASQgYTRiNDFiMjYtYjQ5MS00ZTQ2LTgzMmQtNjIzYTM4MWRlNWM2MTM4M2ViNWRmZGFjNDgxYWE1NTRmYmExNWNmNzMyMTM=",
      }),
    ],
    limiter: MultiRegionRatelimit.fixedWindow(10, "10 s"),
  });
  const { success, pending } = await ratelimit.limit("middleware");
  event.waitUntil(pending);
  console.log("Middleware", success);
  return NextResponse.next();
}

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";
import type { Bindings } from "bindings";

export async function handleRequest(
  _request: Request,
  env: Bindings,
  // @ts-ignore
  context: any,
) {
  const redis = Redis.fromEnv(env);
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 s"),
  });

  const r = await ratelimit.limit("api");
  context.waitUntil(r.pending);

  return new Response(
    r.success
      ? crypto.randomUUID()
      : `Try again after ${new Date(r.reset).toLocaleString()}`,
    {
      status: r.success ? 200 : 429,
      headers: {
        "RateLimit-Limit": r.limit.toString(),
        "RateLimit-Remaining": r.remaining.toString(),
        "RateLimit-Reset": r.reset.toString(),
      },
    },
  );
}

export default { fetch: handleRequest };

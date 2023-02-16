import { Redis } from "@upstash/redis/cloudflare";
import { Ratelimit } from "@upstash/ratelimit";
export interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

const cache = new Map();

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      console.log("URL:", env.UPSTASH_REDIS_REST_URL);

      if (new URL(request.url).pathname !== "/limit") {
        return new Response("go to /limit", { status: 400 });
      }

      const ratelimit = new Ratelimit({
        redis: Redis.fromEnv(env),
        limiter: Ratelimit.cachedFixedWindow(5, "5 s"),
        ephemeralCache: cache,
      });

      const res = await ratelimit.limit("identifier");
      // ctx.waitUntil(res.pending);
      if (res.success) {
        return new Response(JSON.stringify(res, null, 2), { status: 200 });
      } else {
        return new Response(JSON.stringify({ res }, null, 2), { status: 429 });
      }
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  },
};

import { Redis } from "@upstash/redis/cloudflare";
import { Ratelimit } from "@upstash/ratelimit";
export interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

const cache = new Map();

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    if (new URL(request.url).pathname != "/limit") {
      return new Response("go to /limit", { status: 400 });
    }

    const ratelimit = new Ratelimit({
      redis: Redis.fromEnv(env),
      limiter: Ratelimit.fixedWindow(5, "5 s"),
      ephermeralCache: cache,
    });

    const res = await ratelimit.limit("identifier");
    return new Response(JSON.stringify({ res }, null, 2), { status: 200 });
  },
};

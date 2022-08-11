/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Redis } from "@upstash/redis/cloudflare";
import { Ratelimit } from "@upstash/ratelimit";
export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
}

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: "https://eu2-firm-anchovy-30615.upstash.io",
    token:
      "AXeXASQgMmU5NDU1MTgtNzRhNy00ZTRiLWIwYWItODUzMWNiNWQ3MWQ3ZmVlYjA2NDVkZjk4NDA3ZThlMzBlNmFmYTdiYWNkMmQ=",
  }),
  limiter: Ratelimit.fixedWindow(5, "5 s"),
  ephermeralCache: true,
});

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (new URL(request.url).pathname != "/limit") {
      return new Response("go to /limit", { status: 400 });
    }

    const identifier = "me";

    const res = await ratelimit.limit(identifier);
    console.log({ res });
    return new Response(JSON.stringify({ res }, null, 2), { status: 200 });
  },
};

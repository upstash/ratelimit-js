import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://esm.sh/@upstash/redis";

// Create a new ratelimiter, allowing 10 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10s"),
  analytics: true,
  prefix: "@upstash/ratelimit",
});

async function requestHandler(request: Request): Promise<Response> {

  // Use a constant string to limit all requests with a single ratelimit
  // You can also use a userID, apiKey, or IP address for individual limits.
  const identifier = "api";
  
  const { success, remaining } = await ratelimit.limit(identifier);
  if (!success) {
    return new Response("Too Many Requests", { status: 429 });
  }

  // Perform your expensive calculation here
  const body = `Here you go! (Remaining" ${remaining})`;
  return new Response(body, { status: 200 });
}

Deno.serve(requestHandler, { port: 8000 });

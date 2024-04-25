import { serve } from "https://deno.land/std@0.106.0/http/server.ts";
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://esm.sh/@upstash/redis";

const server = serve({ port: 8000 });

// Create a new ratelimiter, allowing 10 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10s"),
  analytics: true,
  prefix: "@upstash/ratelimit",
});

console.log("Server running...");

for await (const req of server) {
  
  if (req.url !== "/") {
    continue
  }

  // Use a constant string to limit all requests with a single ratelimit
  // You can also use a userID, apiKey, or IP address for individual limits.
  const identifier = "api";
  
  const { success, remaining } = await ratelimit.limit(identifier);
  if (!success) {
    req.respond({ status: 429, body: "Too Many Requests" });
    continue;
  }

  // Perform your expensive calculation here
  const body = `Here you go! (Remaining" ${remaining})`;
  req.respond({ body });
}

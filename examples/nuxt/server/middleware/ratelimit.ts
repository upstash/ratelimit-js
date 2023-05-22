import { kv } from "@vercel/kv";
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.fixedWindow(10, "60s"),
});

export default eventHandler(async (e) => {
  if (!e.path.startsWith("/api/")) return;

  const headers = getHeaders(e);

  const ip = headers["x-forwarded-for"] ?? headers["x-real-ip"];

  const { success, limit, remaining, reset } = await ratelimit.limit(ip ?? "anonymous");

  e.context.ratelimit = { success, limit, remaining, reset };
});

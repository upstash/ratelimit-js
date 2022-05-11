import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  const r = await ratelimit.limit("api");

  res.setHeader("X-RateLimit-Limit", r.limit.toString());
  res.setHeader("X-RateLimit-Remaining", r.remaining.toString());
  res.setHeader("X-RateLimit-Reset", r.reset.toString());

  if (!r.success) {
    return res.status(429).send("");
  }

  res.send(crypto.randomInt(100));
}

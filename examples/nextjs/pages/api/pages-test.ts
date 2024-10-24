import { NextApiRequest, NextApiResponse } from "next";

import { waitUntil } from '@vercel/functions';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
  analytics: true
});

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const identifier = "pages-api";
  const { success, limit, remaining, pending } = await ratelimit.limit(identifier);
  const response = {
    success: success,
    limit: limit,
    remaining: remaining
  }

  // pending is a promise for handling the analytics submission
  waitUntil(pending)

  res.status(success ? 200 : 429).json(response);
 
}

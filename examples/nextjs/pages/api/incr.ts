import { Redis } from "@upstash/redis";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  const redis = Redis.fromEnv();
  const count = await redis.incr("nextjs");
  res.json({ count });
}

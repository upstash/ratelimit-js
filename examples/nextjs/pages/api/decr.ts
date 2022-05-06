import { Redis } from "@upstash/redis";
// import https from "https";
// import http from "http";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  const redis = Redis.fromEnv();
  //{
  // agent: new URL(process.env.UPSTASH_REDIS_REST_URL!).protocol === "https:"
  //   ? new https.Agent({ keepAlive: true })
  //   : new http.Agent({ keepAlive: true }),
  //});
  const count = await redis.decr("nextjs");

  res.json({ count });
}

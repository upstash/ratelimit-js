import { Redis } from "@upstash/redis";
import { useEffect, useState } from "react";

function HomePage({ count }: { count: number }) {
  const redis = new Redis({
    url: process.env["NEXT_PUBLIC_UPSTASH_REDIS_REST_URL"]!,
    token: process.env["NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN"]!,
  });
  const [cacheCount, setCacheCount] = useState(count);

  useEffect(() => {
    redis.incr("mykeything").then((c: number) => setCacheCount(c));
  }, []);

  return (
    <div>
      <h2>Count: {cacheCount}</h2>
    </div>
  );
}

export async function getServerSideProps() {
  const redis = Redis.fromEnv();

  const count = (await redis.get<number>("mykeything")) ?? 0;

  return { props: { count } };
}

export default HomePage;

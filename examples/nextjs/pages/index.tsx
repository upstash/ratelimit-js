import { Redis } from "@upstash/redis";
import { useState } from "react";

function HomePage({ count }: { count: number }) {
  const [cacheCount, setCacheCount] = useState(count);

  const incr = async () => {
    const response = await fetch("/api/incr", { method: "GET" });
    const data = await response.json();
    setCacheCount(data.count);
  };

  const decr = async () => {
    const response = await fetch("/api/decr", { method: "GET" });
    const data = await response.json();
    setCacheCount(data.count);
  };

  return (
    <div>
      <h2>Count: {cacheCount}</h2>
      <button type="button" onClick={incr}>
        increment
      </button>
      <button type="button" onClick={decr}>
        decrement
      </button>
    </div>
  );
}

export async function getStaticProps() {
  const redis = Redis.fromEnv();

  const count = await redis.incr("nextjs");

  return { props: { count } };
}

export default HomePage;

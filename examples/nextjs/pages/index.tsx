import type { NextPage } from "next";
import { useEffect, useState } from "react";

const Home: NextPage = () => {
  const [response, setResponse] = useState<Record<string, unknown> | null>(
    null,
  );

  useEffect(() => {}, []);

  const generate = async () => {
    const res = await fetch("/api");

    if (res.ok) {
      setResponse({
        status: res.status,
        body: await res.json(),
        headers: {
          "X-Ratelimit-Limit": res.headers.get("X-Ratelimit-Limit"),
          "X-Ratelimit-Remaining": res.headers.get("X-Ratelimit-Remaining"),
          "X-Ratelimit-Reset": res.headers.get("X-Ratelimit-Reset"),
        },
      });
    } else {
      console.log(JSON.stringify(res.headers, null, 2));
      setResponse(null);
      alert(
        `Ratelimit reached, try again after ${
          new Date(
            parseInt(res.headers.get("X-RateLimit-Reset")!),
          ).toLocaleString()
        }`,
      );
    }
  };
  return (
    <>
      <main>
        <header>
          <h1 className="text-4xl font-bold">
            Welcome to{" "}
            <span className="text-primary-500">@upstash/ratelimit</span>
          </h1>

          <p className="mt-4">
            This is an example of how to ratelimit your nextjs app at the edge
            using Vercel Edge and Upstash Redis
          </p>

          <p className="mt-4">
            Click the button below to make a request, that will be ratelimited
            by your IP.
          </p>
        </header>

        <hr className="my-10" />

        <div className="grid grid-cols-1 gap-6">
          <div className="flex justify-center">
            <button onClick={generate}>Make a request</button>
          </div>

          {response ? <pre>{JSON.stringify(response, null, 2)}</pre> : null}
        </div>
      </main>
    </>
  );
};

export default Home;

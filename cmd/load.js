import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 100 },
    { duration: "30", target: 100 },
    { duration: "10s", target: 0 },
  ],
};

export default function () {
  const res = http.get(
    "https://sdk-ratelimit-qxo1upyjr-upstash.vercel.app/api/hello",
  );
  check(res, {
    "is status 200": (r) => r.status === 200,
  });
}

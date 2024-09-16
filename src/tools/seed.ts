import { Redis } from "@upstash/redis";
import { Analytics } from "../analytics";

const redis = Redis.fromEnv();

const identifier = new Set<string>();

function getId(): string {
  if (identifier.size === 0 || Math.random() > 0.95) {
    const newIp = Array.from({ length: 4 })
      .fill(0)
      .map((_) => Math.floor(Math.random() * 256))
      .join(".");
    identifier.add(newIp);
  }
  return [...identifier][Math.floor(Math.random() * identifier.size)];
}

const a = new Analytics({ redis });

async function main() {
  const now = Date.now();
  for (let i = 0; i < 1000; i++) {
    await Promise.all(
      Array.from({ length: 100 }).fill(0).map((_) =>
        a.record({
          time: now - Math.round(Math.random() * 7 * 24 * 60 * 60 * 1000),
          identifier: getId(),
          success: Math.random() > 0.2,
        }),
      ),
    );
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main();

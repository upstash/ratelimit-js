import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

const packageManager = "npm";
const outDir = "./dist";

await emptyDir(outDir);

await build({
  packageManager,
  entryPoints: ["src/mod.ts"],
  outDir,
  shims: {
    deno: true,
    crypto: "dev",
    custom: [
      /**
       * Workaround for testing the build in nodejs
       */
      {
        package: { name: "@types/node", version: "latest" },
        typesPackage: { name: "@types/node", version: "latest" },
        globalNames: [],
      },
    ],
  },
  typeCheck: true,
  test: typeof Deno.env.get("TEST") !== "undefined",
  package: {
    // package.json properties
    name: "@upstash/ratelimit",
    version: Deno.args[0],
    description: "A serverless ratelimiter built on top of Upstash REST API.",
    repository: {
      type: "git",
      url: "git+https://github.com/upstash/ratelimiter.git",
    },
    keywords: ["rate", "limit", "redis", "serverless", "edge", "upstash"],
    author: "Andreas Thomas <andreas.thomas@chronark.com>",
    license: "MIT",
    bugs: {
      url: "https://github.com/upstash/ratelimiter/issues",
    },
    homepage: "https://github.com/upstash/ratelimiter#readme",

    devDependencies: {
      "size-limit": "latest",
      "@size-limit/preset-small-lib": "latest",
      "@upstash/redis": "1.3.1",
    },
    peerDependencies: {
      "@upstash/redis": "1.3.1",
    },
    "size-limit": [
      {
        path: "esm/platforms/nodejs.js",
        limit: "5 KB",
      },
      {
        path: "esm/platforms/fastly.js",
        limit: "5 KB",
      },
      {
        path: "esm/platforms/cloudflare.js",
        limit: "5 KB",
      },

      {
        path: "script/platforms/nodejs.js",
        limit: "10 KB",
      },
      {
        path: "script/platforms/fastly.js",
        limit: "10 KB",
      },
      {
        path: "script/platforms/cloudflare.js",
        limit: "10 KB",
      },
    ],
  },
});

// post build steps
Deno.copyFileSync(".github/LICENSE", `${outDir}/LICENSE`);
Deno.copyFileSync(".github/README.md", `${outDir}/README.md`);

/**
 * Workaround because currently deno can not typecheck the built modules without `@types/node` being installed as regular dependency
 *
 * This removes it after everything is tested.
 */
await Deno.run({
  cwd: outDir,
  cmd: [packageManager, "uninstall", "@types/node"],
  stdout: "piped",
}).output();

import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    // commands: "./pkg/commands/index.ts",
    // http: "./pkg/http.ts",
    // cloudflare: "./pkg/cloudflare.ts",
    // fastly: "./pkg/fastly.ts",
    // nodejs: "./pkg/nodejs.ts",
  },
  format: ["cjs", "esm"],
  clean: true,
  bundle: true,
  dts: true,
});

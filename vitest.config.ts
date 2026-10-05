import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/worker/index.ts",
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: { include: ["tests/**/*.test.ts"], setupFiles: ["./tests/setup.ts"] },
});

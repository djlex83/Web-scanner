import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/worker/index.ts",
      // Workers AI läuft nur bei Cloudflare; Tests dürfen ohne Konto und Netz laufen
      remoteBindings: false,
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: { bindings: { NOTFALL_CODE: "test-notfall-code-1234567890" } },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    deps: {
      // Der Workers-Pool lädt jede Datei aus node_modules einzeln über Vite nach.
      // Zod v4 besteht aus über hundert Modulen (inkl. aller Sprachpakete), Hono aus
      // Dutzenden – das kostete beim ersten Laden je Testdatei 2–3 s. Vorgebündelt
      // ist es jeweils nur noch ein Modul.
      optimizer: { ssr: { enabled: true, include: ["zod", "hono"] } },
    },
  },
});

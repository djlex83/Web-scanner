import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

/** Versionskennung fürs Bauen: Commit-Kennung (bei Cloudflare aus der Umgebung, sonst aus git) und Bauzeit. */
function version() {
  let commit = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? "";
  if (!commit) {
    try {
      commit = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      commit = "";
    }
  }
  return { kennung: commit.slice(0, 7) || "dev", gebaut: new Date().toISOString() };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  build: { chunkSizeWarningLimit: 900 },
  define: { __APP_VERSION__: JSON.stringify(version()) },
});

import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import { schemaVergessen } from "../src/worker/db/migrationen";

// Jeder Test beginnt mit einer leeren Datenbank.
beforeEach(async () => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
  ).all<{ name: string }>();
  // Kindtabellen zuerst, damit keine Fremdschlüssel verletzt werden
  const zuerst = ["sitzungen", "buchungen", "protokoll", "ausleihen", "pruefungen", "inventuren", "fotos", "stuecke", "plaetze", "benutzer"];
  const namen = [...zuerst, ...results.map((r) => r.name).filter((n) => !zuerst.includes(n))];
  for (const name of namen) await env.DB.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
  schemaVergessen();
});

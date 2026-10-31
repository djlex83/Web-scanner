import { env } from "cloudflare:workers";
import { beforeAll, beforeEach } from "vitest";
import { schemaSicherstellen, schemaVergessen } from "../src/worker/db/migrationen";

// Jede Testdatei bekommt eine frische Workers-Laufzeit; das Worker-Modul (mit Hono und
// Zod) wird dort erst bei der ersten Anfrage geladen. Das dauert ein bis drei Sekunden und
// lief bisher in die 5-s-Grenze des jeweils ersten Tests. Hier einmal vorab laden – das
// ist dieselbe Modulinstanz, die `exports.default.fetch` später benutzt.
beforeAll(async () => {
  await import("../src/worker/index");
}, 30_000);

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
  // Schema schrittweise einspielen (wie in mehreren Aufrufen nacheinander)
  for (let i = 0; i < 5; i++) {
    try {
      await schemaSicherstellen(env.DB);
      break;
    } catch {
      /* nächster Schritt */
    }
  }
});

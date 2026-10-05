import { Hono } from "hono";
import { istPlatzCode, normalisiereCode } from "../../gemeinsam/codes";
import { scanSchema } from "../../gemeinsam/schemas";
import type { ScanTreffer } from "../../gemeinsam/typen";
import { alsJson, plaetzeLaden, STUECK_SELECT, zuPlatz, zuStueck, type StueckZeile } from "../db/abfragen";
import { braucht, eingabe, type AppEnv } from "../kontext";

export const scanRouten = new Hono<AppEnv>();

/** Löst gescannte Codes auf: Stück, Platz oder unbekannt – in der Reihenfolge der Eingabe. */
scanRouten.post("/", braucht("abfragen"), async (c) => {
  const e = await eingabe(c, scanSchema);
  const codes = [...new Set(e.codes.map(normalisiereCode).filter(Boolean))];
  const stueckCodes = codes.filter((k) => !istPlatzCode(k));
  const karte = await plaetzeLaden(c.env.DB);

  const stuecke = new Map<string, StueckZeile>();
  if (stueckCodes.length) {
    const { results } = await c.env.DB.prepare(
      `${STUECK_SELECT} WHERE s.code IN (SELECT value FROM json_each(?))`,
    )
      .bind(alsJson(stueckCodes))
      .all<StueckZeile>();
    for (const z of results) stuecke.set(z.code, z);
  }
  const platzNachCode = new Map([...karte.values()].map((p) => [p.code.toUpperCase(), p]));
  let anzahlen: Map<number, number> | null = null;

  const treffer: ScanTreffer[] = [];
  for (const code of codes) {
    if (istPlatzCode(code)) {
      const p = platzNachCode.get(code.toUpperCase());
      if (!p) {
        treffer.push({ code, art: "unbekannt" });
        continue;
      }
      if (!anzahlen) {
        const { results } = await c.env.DB.prepare(
          "SELECT platz_id, COUNT(*) AS n FROM stuecke WHERE status != 'ausgemustert' AND platz_id IS NOT NULL GROUP BY platz_id",
        ).all<{ platz_id: number; n: number }>();
        anzahlen = new Map(results.map((r) => [r.platz_id, r.n]));
      }
      treffer.push({ code, art: "platz", platz: zuPlatz(karte, p, anzahlen.get(p.id) ?? 0) });
    } else {
      const z = stuecke.get(code);
      treffer.push(z ? { code, art: "stueck", stueck: zuStueck(karte, z) } : { code, art: "unbekannt" });
    }
  }
  return c.json(treffer);
});

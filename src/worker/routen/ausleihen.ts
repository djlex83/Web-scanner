import { Hono } from "hono";
import { deDatum } from "../csv";
import { ausleihenSchema, stueckListeSchema } from "../../gemeinsam/schemas";
import type { Ausleihe } from "../../gemeinsam/typen";
import { alsJson, plaetzeLaden, STUECK_SELECT, zuStueck, type PlatzKarte, type StueckZeile } from "../db/abfragen";
import { stueckeLaden } from "../db/bewegen";
import { benutzerVon, braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";

export const ausleihenRouten = new Hono<AppEnv>();

interface AusleiheZeile {
  id: number;
  stueck_id: number;
  an: string;
  bis: string | null;
  notiz: string | null;
  ausgegeben_am: string;
  ausgegeben_von: string;
  zurueck_am: string | null;
  zurueck_von: string | null;
}

export async function ausleihenAbfragen(
  db: D1Database,
  karte: PlatzKarte,
  f: { stueck_id?: number; offen?: boolean; limit: number },
): Promise<Ausleihe[]> {
  const bed: string[] = [];
  const werte: (string | number)[] = [];
  if (f.stueck_id) (bed.push("a.stueck_id = ?"), werte.push(f.stueck_id));
  if (f.offen) bed.push("a.zurueck_am IS NULL");
  const { results } = await db
    .prepare(
      `SELECT a.id, a.stueck_id, a.an, a.bis, a.notiz, a.ausgegeben_am, u.name AS ausgegeben_von, a.zurueck_am, z.name AS zurueck_von
       FROM ausleihen a JOIN benutzer u ON u.id = a.benutzer_id LEFT JOIN benutzer z ON z.id = a.zurueck_von_id
       ${bed.length ? "WHERE " + bed.join(" AND ") : ""}
       ORDER BY ${f.offen ? "a.bis IS NULL, a.bis, a.ausgegeben_am, a.id" : "a.ausgegeben_am DESC, a.id DESC"} LIMIT ?`,
    )
    .bind(...werte, f.limit)
    .all<AusleiheZeile>();
  if (!results.length) return [];
  const { results: stuecke } = await db
    .prepare(`${STUECK_SELECT} WHERE s.id IN (SELECT value FROM json_each(?))`)
    .bind(alsJson([...new Set(results.map((r) => r.stueck_id))]))
    .all<StueckZeile>();
  const nachId = new Map(stuecke.map((z) => [z.id, zuStueck(karte, z)]));
  return results.map(({ stueck_id, ...r }) => ({ ...r, stueck: nachId.get(stueck_id)! }));
}

/** Offene Ausleihen (Standard) oder die letzten 200 inklusive zurückgegebener. */
ausleihenRouten.get("/", braucht("abfragen"), async (c) => {
  const karte = await plaetzeLaden(c.env.DB);
  const alle = c.req.query("alle") === "1";
  return c.json(await ausleihenAbfragen(c.env.DB, karte, { offen: !alle, limit: alle ? 200 : 1000 }));
});

/** Bisherige Namen als Vorschläge für „An wen?“ */
ausleihenRouten.get("/namen", braucht("buchen"), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT an FROM ausleihen GROUP BY an COLLATE NOCASE ORDER BY MAX(ausgegeben_am) DESC LIMIT 30",
  ).all<{ an: string }>();
  return c.json(results.map((r) => r.an));
});

ausleihenRouten.post("/", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, ausleihenSchema);
  const ids = [...new Set(e.stueck_ids)];
  const stuecke = await stueckeLaden(c.env.DB, ids);
  if (stuecke.length !== ids.length) fehler(400, "Mindestens ein Stück wurde nicht gefunden");
  const ausgemustert = stuecke.find((s) => s.status === "ausgemustert");
  if (ausgemustert) fehler(400, `„${ausgemustert.name}“ ist ausgemustert`);
  const schon = stuecke.find((s) => s.verliehen);
  if (schon) fehler(409, `„${schon.name}“ ist schon verliehen`);
  const zeit = jetzt();
  const bis = e.bis ? ` bis ${deDatum(e.bis)}` : "";
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO ausleihen (stueck_id, an, bis, notiz, benutzer_id, ausgegeben_am)
       SELECT value, ?, ?, ?, ?, ? FROM json_each(?)`,
    ).bind(e.an, e.bis ?? null, e.notiz, ich.id, zeit, alsJson(ids)),
    protokollEintrag(c, {
      aktion: "ausgeliehen",
      objekt_typ: "stueck",
      objekt_id: ids.length === 1 ? ids[0] : null,
      text:
        ids.length === 1
          ? `„${stuecke[0]!.name}“ (${stuecke[0]!.code}) an ${e.an} ausgegeben${bis}`
          : `${ids.length} Stücke an ${e.an} ausgegeben${bis}`,
      nachher: { an: e.an, bis: e.bis ?? null, notiz: e.notiz, stuecke: stuecke.map((s) => ({ code: s.code, name: s.name })) },
    }),
  ]);
  return c.json({ ausgegeben: ids.length });
});

ausleihenRouten.post("/zurueck", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, stueckListeSchema);
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.an, s.code, s.name FROM ausleihen a JOIN stuecke s ON s.id = a.stueck_id
     WHERE a.zurueck_am IS NULL AND a.stueck_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(alsJson(e.stueck_ids))
    .all<{ id: number; an: string; code: string; name: string }>();
  if (!results.length) fehler(409, "Keines der Stücke ist verliehen");
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE ausleihen SET zurueck_am = ?, zurueck_von_id = ? WHERE id IN (SELECT value FROM json_each(?))",
    ).bind(jetzt(), ich.id, alsJson(results.map((r) => r.id))),
    protokollEintrag(c, {
      aktion: "zurueckgegeben",
      objekt_typ: "stueck",
      text:
        results.length === 1
          ? `„${results[0]!.name}“ (${results[0]!.code}) von ${results[0]!.an} zurückgenommen`
          : `${results.length} Stücke zurückgenommen`,
      nachher: { stuecke: results.map((r) => ({ code: r.code, name: r.name, von: r.an })), notiz: e.notiz },
    }),
  ]);
  return c.json({ zurueck: results.length, nicht_verliehen: e.stueck_ids.length - results.length });
});

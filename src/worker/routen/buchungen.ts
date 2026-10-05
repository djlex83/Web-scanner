import { Hono } from "hono";
import { buchenSchema } from "../../gemeinsam/schemas";
import type { Buchung, BuchungsArt, Seite } from "../../gemeinsam/typen";
import { alsJson, platzPfad, plaetzeLaden, type PlatzKarte } from "../db/abfragen";
import { benutzerVon, braucht, eingabe, fehler, geraet, jetzt, type AppEnv } from "../kontext";

export const buchungenRouten = new Hono<AppEnv>();

interface BuchungsZeile {
  id: number;
  vorgang_id: string;
  art: BuchungsArt;
  zeitpunkt: string;
  benutzer: string;
  von_platz_id: number | null;
  nach_platz_id: number | null;
  notiz: string | null;
  stueck_id: number;
  stueck_code: string;
  stueck_name: string;
}

export interface BuchungsFilter {
  stueck_id?: number;
  benutzer_id?: number;
  von?: string;
  bis?: string;
  vor_id?: number;
  limit?: number;
}

/** Buchungen, neueste zuerst; Blättern über vor_id. */
export async function buchungenAbfragen(
  db: D1Database,
  karte: PlatzKarte,
  f: BuchungsFilter,
): Promise<Seite<Buchung>> {
  const bed: string[] = [];
  const werte: (string | number)[] = [];
  if (f.stueck_id) (bed.push("b.stueck_id = ?"), werte.push(f.stueck_id));
  if (f.benutzer_id) (bed.push("b.benutzer_id = ?"), werte.push(f.benutzer_id));
  if (f.von) (bed.push("b.zeitpunkt >= ?"), werte.push(f.von));
  if (f.bis) (bed.push("b.zeitpunkt < ?"), werte.push(f.bis));
  if (f.vor_id) (bed.push("b.id < ?"), werte.push(f.vor_id));
  const limit = f.limit ?? 50;
  const { results } = await db
    .prepare(
      `SELECT b.id, b.vorgang_id, b.art, b.zeitpunkt, u.name AS benutzer, b.von_platz_id, b.nach_platz_id,
              b.notiz, s.id AS stueck_id, s.code AS stueck_code, s.name AS stueck_name
       FROM buchungen b JOIN benutzer u ON u.id = b.benutzer_id JOIN stuecke s ON s.id = b.stueck_id
       ${bed.length ? "WHERE " + bed.join(" AND ") : ""}
       ORDER BY b.id DESC LIMIT ?`,
    )
    .bind(...werte, limit + 1)
    .all<BuchungsZeile>();
  return {
    eintraege: results.slice(0, limit).map((z) => ({
      id: z.id,
      vorgang_id: z.vorgang_id,
      art: z.art,
      zeitpunkt: z.zeitpunkt,
      benutzer: z.benutzer,
      von: z.von_platz_id ? platzPfad(karte, z.von_platz_id) : null,
      nach: z.nach_platz_id ? platzPfad(karte, z.nach_platz_id) : null,
      notiz: z.notiz,
      stueck: { id: z.stueck_id, code: z.stueck_code, name: z.stueck_name },
    })),
    weitere: results.length > limit,
  };
}

/** Mehrere Stücke auf einen Platz buchen – eine Transaktion, alles oder nichts. */
buchungenRouten.post("/", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, buchenSchema);
  const karte = await plaetzeLaden(c.env.DB);
  const ziel = karte.get(e.nach_platz_id);
  if (!ziel || !ziel.aktiv) fehler(400, "Zielplatz nicht gefunden");

  const ids = [...new Set(e.stueck_ids)];
  const { results: stuecke } = await c.env.DB.prepare(
    "SELECT id, code, name, platz_id, status FROM stuecke WHERE id IN (SELECT value FROM json_each(?))",
  )
    .bind(alsJson(ids))
    .all<{ id: number; code: string; name: string; platz_id: number | null; status: string }>();
  if (stuecke.length !== ids.length) fehler(400, "Mindestens ein Stück wurde nicht gefunden");
  const ausgemustert = stuecke.find((s) => s.status === "ausgemustert");
  if (ausgemustert) fehler(400, `„${ausgemustert.name}“ ist ausgemustert und kann nicht gebucht werden`);

  const zuBuchen = stuecke.filter((s) => s.platz_id !== ziel.id);
  const vorgang = crypto.randomUUID();
  const zeit = jetzt();
  const zielPfad = platzPfad(karte, ziel.id);
  if (zuBuchen.length) {
    const liste = alsJson(zuBuchen.map((s) => s.id));
    const text =
      zuBuchen.length === 1
        ? `„${zuBuchen[0]!.name}“ (${zuBuchen[0]!.code}) → ${zielPfad}`
        : `${zuBuchen.length} Stücke → ${zielPfad}`;
    await c.env.DB.batch([
      // Reihenfolge wichtig: erst Buchungen mit altem Platz schreiben, dann Stücke ändern
      c.env.DB.prepare(
        `INSERT INTO buchungen (vorgang_id, stueck_id, von_platz_id, nach_platz_id, art, benutzer_id, zeitpunkt, notiz)
         SELECT ?, id, platz_id, ?, 'umbuchen', ?, ?, ? FROM stuecke WHERE id IN (SELECT value FROM json_each(?))`,
      ).bind(vorgang, ziel.id, ich.id, zeit, e.notiz, liste),
      c.env.DB.prepare(
        `INSERT INTO protokoll (zeitpunkt, benutzer_id, aktion, objekt_typ, objekt_id, text, nachher_json, geraet)
         VALUES (?, ?, 'umgebucht', 'platz', ?, ?, ?, ?)`,
      ).bind(
        zeit,
        ich.id,
        ziel.id,
        text,
        JSON.stringify({
          vorgang_id: vorgang,
          nach: zielPfad,
          stuecke: zuBuchen.map((s) => ({
            code: s.code,
            name: s.name,
            von: s.platz_id ? platzPfad(karte, s.platz_id) : null,
          })),
          notiz: e.notiz,
        }),
        geraet(c),
      ),
      c.env.DB.prepare(
        `UPDATE stuecke SET platz_id = ?, bewegt_am = ?, bewegt_von_id = ?, geaendert_am = ?
         WHERE id IN (SELECT value FROM json_each(?))`,
      ).bind(ziel.id, zeit, ich.id, zeit, liste),
    ]);
  }
  return c.json({
    vorgang_id: zuBuchen.length ? vorgang : null,
    gebucht: zuBuchen.length,
    schon_dort: stuecke.length - zuBuchen.length,
    ziel: zielPfad,
  });
});

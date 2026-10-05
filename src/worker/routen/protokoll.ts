import { Hono } from "hono";
import { darf } from "../../gemeinsam/rechte";
import type { ProtokollEintrag, Seite } from "../../gemeinsam/typen";
import { plaetzeLaden } from "../db/abfragen";
import { benutzerVon, braucht, type AppEnv, type Ctx } from "../kontext";
import { buchungenAbfragen, type BuchungsFilter } from "./buchungen";

export const protokollRouten = new Hono<AppEnv>();

const CSV_MAX = 20_000;

interface Filter {
  benutzer_id?: number;
  von?: string;
  bis?: string;
  vor_id?: number;
  objekt_typ?: string;
}

/** Filter aus der URL; ohne Recht "protokoll_alle" immer nur die eigenen Einträge. */
function filterLesen(c: Ctx): Filter {
  const ich = benutzerVon(c);
  const zahl = (n: string | undefined) => (n && /^[0-9]+$/.test(n) ? Number(n) : undefined);
  const datum = (d: string | undefined) => (d && !Number.isNaN(Date.parse(d)) ? new Date(d).toISOString() : undefined);
  const typ = c.req.query("objekt_typ");
  return {
    benutzer_id: darf(ich.rolle, "protokoll_alle") ? zahl(c.req.query("benutzer_id")) : ich.id,
    von: datum(c.req.query("von")),
    bis: datum(c.req.query("bis")),
    vor_id: zahl(c.req.query("vor_id")),
    objekt_typ: typ && /^[a-z]+$/.test(typ) ? typ : undefined,
  };
}

async function protokollAbfragen(db: D1Database, f: Filter, limit: number): Promise<Seite<ProtokollEintrag>> {
  const bed: string[] = [];
  const werte: (string | number)[] = [];
  if (f.benutzer_id) (bed.push("p.benutzer_id = ?"), werte.push(f.benutzer_id));
  if (f.von) (bed.push("p.zeitpunkt >= ?"), werte.push(f.von));
  if (f.bis) (bed.push("p.zeitpunkt < ?"), werte.push(f.bis));
  if (f.vor_id) (bed.push("p.id < ?"), werte.push(f.vor_id));
  if (f.objekt_typ) (bed.push("p.objekt_typ = ?"), werte.push(f.objekt_typ));
  const { results } = await db
    .prepare(
      `SELECT p.id, p.zeitpunkt, u.name AS benutzer, p.aktion, p.objekt_typ, p.objekt_id, p.text
       FROM protokoll p LEFT JOIN benutzer u ON u.id = p.benutzer_id
       ${bed.length ? "WHERE " + bed.join(" AND ") : ""}
       ORDER BY p.id DESC LIMIT ?`,
    )
    .bind(...werte, limit + 1)
    .all<ProtokollEintrag>();
  return { eintraege: results.slice(0, limit), weitere: results.length > limit };
}

const ortszeit = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  dateStyle: "short",
  timeStyle: "medium",
});

function csv(kopf: string[], zeilen: (string | number | null)[][]): string {
  const feld = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM + Semikolon, damit Excel (deutsch) Umlaute und Spalten richtig erkennt
  return "﻿" + [kopf, ...zeilen].map((z) => z.map(feld).join(";")).join("\r\n") + "\r\n";
}

function csvAntwort(c: Ctx, name: string, inhalt: string) {
  const tag = new Date().toISOString().slice(0, 10);
  return c.body(inhalt, 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${name}-${tag}.csv"`,
  });
}

protokollRouten.get("/", braucht("abfragen"), async (c) => {
  return c.json(await protokollAbfragen(c.env.DB, filterLesen(c), 50));
});

protokollRouten.get("/bewegungen", braucht("abfragen"), async (c) => {
  const f: BuchungsFilter = { ...filterLesen(c), limit: 50 };
  return c.json(await buchungenAbfragen(c.env.DB, await plaetzeLaden(c.env.DB), f));
});

protokollRouten.get("/csv", braucht("abfragen"), async (c) => {
  const { eintraege } = await protokollAbfragen(c.env.DB, filterLesen(c), CSV_MAX);
  return csvAntwort(
    c,
    "protokoll",
    csv(
      ["Zeit", "Zeit (UTC)", "Benutzer", "Aktion", "Objekt", "Objekt-ID", "Beschreibung"],
      eintraege.map((e) => [
        ortszeit.format(new Date(e.zeitpunkt)),
        e.zeitpunkt,
        e.benutzer,
        e.aktion,
        e.objekt_typ,
        e.objekt_id,
        e.text,
      ]),
    ),
  );
});

protokollRouten.get("/bewegungen/csv", braucht("abfragen"), async (c) => {
  const f: BuchungsFilter = { ...filterLesen(c), limit: CSV_MAX };
  const { eintraege } = await buchungenAbfragen(c.env.DB, await plaetzeLaden(c.env.DB), f);
  return csvAntwort(
    c,
    "bewegungen",
    csv(
      ["Zeit", "Zeit (UTC)", "Benutzer", "Art", "Code", "Stück", "Von", "Nach", "Notiz"],
      eintraege.map((b) => [
        ortszeit.format(new Date(b.zeitpunkt)),
        b.zeitpunkt,
        b.benutzer,
        b.art,
        b.stueck?.code ?? "",
        b.stueck?.name ?? "",
        b.von,
        b.nach,
        b.notiz,
      ]),
    ),
  );
});

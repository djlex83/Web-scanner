import { Hono } from "hono";
import { darf } from "../../gemeinsam/rechte";
import { buchenSchema, rueckgaengigSchema, stueckListeSchema } from "../../gemeinsam/schemas";
import type { Buchung, BuchungsArt, Seite, StueckKurz } from "../../gemeinsam/typen";
import { alsJson, platzPfad, plaetzeLaden, type PlatzKarte } from "../db/abfragen";
import { bewegen, bewegungenZu, stueckeLaden, zielLaden, zielText, type Bewegung, type StueckOrt } from "../db/bewegen";
import { benutzerVon, braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv, type Ctx } from "../kontext";

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
  mitgefuehrt: number;
  von_behaelter: string | null;
  nach_behaelter: string | null;
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

/** "Regal 3 › Kiste 7" – Platz und (optional) Behälter */
function ortText(karte: PlatzKarte, platzId: number | null, behaelter: string | null): string | null {
  const platz = platzId ? platzPfad(karte, platzId) : null;
  if (!behaelter) return platz;
  return platz ? `${platz} › ${behaelter}` : behaelter;
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
              b.notiz, b.mitgefuehrt, vb.name AS von_behaelter, nb.name AS nach_behaelter,
              s.id AS stueck_id, s.code AS stueck_code, s.name AS stueck_name
       FROM buchungen b JOIN benutzer u ON u.id = b.benutzer_id JOIN stuecke s ON s.id = b.stueck_id
       LEFT JOIN stuecke vb ON vb.id = b.von_behaelter_id LEFT JOIN stuecke nb ON nb.id = b.nach_behaelter_id
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
      von: ortText(karte, z.von_platz_id, z.von_behaelter),
      nach: ortText(karte, z.nach_platz_id, z.nach_behaelter),
      notiz: z.notiz,
      mitgefuehrt: z.mitgefuehrt === 1,
      stueck: { id: z.stueck_id, code: z.stueck_code, name: z.stueck_name },
    })),
    weitere: results.length > limit,
  };
}

/** Bucht Stücke um und schreibt das Protokoll – gemeinsam für Einlagern, Inventur und Rückgängig. */
export function umbuchenStatements(
  c: Ctx,
  karte: PlatzKarte,
  e: {
    vorgang: string;
    bewegungen: Bewegung[];
    stuecke: StueckOrt[];
    text: string;
    aktion?: string;
    notiz?: string | null;
    objekt_id?: number | null;
    nachher?: Record<string, unknown>;
    stamm?: "wenn_leer" | "nie";
  },
): D1PreparedStatement[] {
  const ich = benutzerVon(c);
  const nachId = new Map(e.stuecke.map((s) => [s.id, s]));
  const bewegt = e.bewegungen.map((b) => nachId.get(b.s)!);
  const gefunden = bewegt.filter((s) => s.vermisst_seit).length;
  const zurueck = bewegt.filter((s) => s.verliehen).length;
  const zusatz = [
    gefunden && `${gefunden} vermisste${gefunden === 1 ? "s" : ""} gefunden`,
    zurueck && `${zurueck} Ausleihe${zurueck === 1 ? "" : "n"} beendet`,
  ].filter(Boolean);
  return [
    ...bewegen(
      c.env.DB,
      { vorgang: e.vorgang, benutzer_id: ich.id, zeit: jetzt(), notiz: e.notiz ?? null, stamm: e.stamm },
      e.bewegungen,
    ),
    protokollEintrag(c, {
      aktion: e.aktion ?? "umgebucht",
      objekt_typ: "platz",
      objekt_id: e.objekt_id ?? null,
      text: e.text + (zusatz.length ? ` (${zusatz.join(", ")})` : ""),
      nachher: {
        vorgang_id: e.vorgang,
        ...e.nachher,
        stuecke: e.bewegungen.map((b) => {
          const s = nachId.get(b.s)!;
          return {
            code: s.code,
            name: s.name,
            von: s.platz_id ? platzPfad(karte, s.platz_id) : null,
            von_behaelter_id: s.in_behaelter_id,
            nach: b.p ? platzPfad(karte, b.p) : null,
            nach_behaelter_id: b.b,
          };
        }),
        notiz: e.notiz ?? null,
      },
    }),
  ];
}

/** Mehrere Stücke auf einen Platz oder in einen Behälter buchen – eine Transaktion, alles oder nichts. */
buchungenRouten.post("/", braucht("buchen"), async (c) => {
  const e = await eingabe(c, buchenSchema);
  const karte = await plaetzeLaden(c.env.DB);
  const ziel = await zielLaden(c.env.DB, karte, e);
  const ids = [...new Set(e.stueck_ids)];
  const stuecke = await stueckeLaden(c.env.DB, ids);
  if (stuecke.length !== ids.length) fehler(400, "Mindestens ein Stück wurde nicht gefunden");
  const { bewegungen, schonDort } = bewegungenZu(ziel, stuecke);

  const vorgang = crypto.randomUUID();
  const zielPfad = zielText(karte, ziel);
  const stmts: D1PreparedStatement[] = [];
  if (bewegungen.length) {
    const erstes = stuecke.find((s) => s.id === bewegungen[0]!.s)!;
    stmts.push(
      ...umbuchenStatements(c, karte, {
        vorgang,
        bewegungen,
        stuecke,
        notiz: e.notiz,
        objekt_id: ziel.art === "platz" ? ziel.platz.id : null,
        nachher: { nach: zielPfad, stammplatz: e.stammplatz },
        stamm: e.stammplatz ? "nie" : "wenn_leer",
        text:
          (bewegungen.length === 1
            ? `„${erstes.name}“ (${erstes.code}) → ${zielPfad}`
            : `${bewegungen.length} Stücke → ${zielPfad}`) + (e.stammplatz ? " (neuer Stammplatz)" : ""),
      }),
    );
  }
  if (e.stammplatz) {
    // auch für Stücke, die schon dort liegen
    stmts.push(
      c.env.DB.prepare(
        "UPDATE stuecke SET stamm_platz_id = ?, stamm_behaelter_id = ? WHERE id IN (SELECT value FROM json_each(?))",
      ).bind(ziel.art === "platz" ? ziel.platz.id : null, ziel.art === "behaelter" ? ziel.behaelter.id : null, alsJson(ids)),
    );
    if (!bewegungen.length) {
      stmts.push(
        protokollEintrag(c, {
          aktion: "stammplatz",
          objekt_typ: "platz",
          objekt_id: ziel.art === "platz" ? ziel.platz.id : null,
          text: `Stammplatz ${zielPfad} für ${ids.length === 1 ? `„${stuecke[0]!.name}“` : `${ids.length} Stücke`} festgelegt`,
          nachher: { stammplatz: zielPfad, stuecke: stuecke.map((s) => s.code) },
        }),
      );
    }
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({
    vorgang_id: bewegungen.length ? vorgang : null,
    gebucht: bewegungen.length,
    schon_dort: schonDort,
    ziel: zielPfad,
  });
});

const RUECKGAENGIG_MINUTEN = 15;

/** Macht einen Buchungsvorgang durch Gegenbuchungen rückgängig (nichts wird gelöscht). */
buchungenRouten.post("/rueckgaengig", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const { vorgang_id } = await eingabe(c, rueckgaengigSchema);
  const { results } = await c.env.DB.prepare(
    `SELECT b.stueck_id, b.benutzer_id, b.zeitpunkt, b.von_platz_id, b.nach_platz_id, b.von_behaelter_id, b.nach_behaelter_id,
            vb.platz_id AS behaelter_platz_id, vb.behaelter AS ist_behaelter, vb.status AS behaelter_status
     FROM buchungen b LEFT JOIN stuecke vb ON vb.id = b.von_behaelter_id
     WHERE b.vorgang_id = ? AND b.mitgefuehrt = 0`,
  )
    .bind(vorgang_id)
    .all<{
      stueck_id: number;
      benutzer_id: number;
      zeitpunkt: string;
      von_platz_id: number | null;
      nach_platz_id: number | null;
      von_behaelter_id: number | null;
      nach_behaelter_id: number | null;
      behaelter_platz_id: number | null;
      ist_behaelter: number | null;
      behaelter_status: string | null;
    }>();
  if (!results.length) fehler(404, "Buchung nicht gefunden");
  if (!darf(ich.rolle, "stuecke_verwalten")) {
    const grenze = new Date(Date.now() - RUECKGAENGIG_MINUTEN * 60_000).toISOString();
    if (results.some((r) => r.benutzer_id !== ich.id || r.zeitpunkt < grenze)) {
      fehler(403, `Rückgängig geht nur für eigene Buchungen der letzten ${RUECKGAENGIG_MINUTEN} Minuten`);
    }
  }
  const karte = await plaetzeLaden(c.env.DB);
  const stuecke = await stueckeLaden(c.env.DB, results.map((r) => r.stueck_id));
  const nachId = new Map(stuecke.map((s) => [s.id, s]));
  const bewegungen: Bewegung[] = [];
  for (const r of results) {
    const s = nachId.get(r.stueck_id);
    // nur Stücke, die seitdem nicht weiterbewegt wurden
    if (!s || s.status === "ausgemustert" || s.platz_id !== r.nach_platz_id || s.in_behaelter_id !== r.nach_behaelter_id) continue;
    const kisteOk = r.von_behaelter_id && r.ist_behaelter === 1 && r.behaelter_status !== "ausgemustert";
    bewegungen.push(
      kisteOk
        ? { s: s.id, p: r.behaelter_platz_id, b: r.von_behaelter_id }
        : { s: s.id, p: r.von_platz_id, b: null },
    );
  }
  if (!bewegungen.length) fehler(409, "Schon rückgängig gemacht oder inzwischen weiterbewegt");
  const vorgang = crypto.randomUUID();
  await c.env.DB.batch(
    umbuchenStatements(c, karte, {
      vorgang,
      bewegungen,
      stuecke,
      aktion: "rueckgaengig",
      notiz: "Rückgängig",
      stamm: "nie",
      nachher: { rueckgaengig_von: vorgang_id },
      text: `Rückgängig: ${bewegungen.length === 1 ? `„${nachId.get(bewegungen[0]!.s)!.name}“ zurückgebucht` : `${bewegungen.length} Stücke zurückgebucht`}`,
    }),
  );
  return c.json({ vorgang_id: vorgang, zurueck: bewegungen.length, uebersprungen: results.length - bewegungen.length });
});

/**
 * Zurückräumen: jedes Stück an seinen eigenen Stammplatz – alle in einem Vorgang.
 * Stücke ohne Stammplatz werden übersprungen und zurückgemeldet.
 */
buchungenRouten.post("/zurueckraeumen", braucht("buchen"), async (c) => {
  const e = await eingabe(c, stueckListeSchema);
  const karte = await plaetzeLaden(c.env.DB);
  const ids = [...new Set(e.stueck_ids)];
  const stuecke = (await stueckeLaden(c.env.DB, ids)).filter((s) => s.status !== "ausgemustert");
  const kisten = new Map(
    (await stueckeLaden(c.env.DB, [...new Set(stuecke.flatMap((s) => (s.stamm_behaelter_id ? [s.stamm_behaelter_id] : [])))])).map(
      (k) => [k.id, k],
    ),
  );
  const bewegungen: Bewegung[] = [];
  const ohne: StueckKurz[] = [];
  let schonDort = 0;
  for (const s of stuecke) {
    let ziel: { p: number | null; b: number | null } | null = null;
    const kiste = s.stamm_behaelter_id ? kisten.get(s.stamm_behaelter_id) : undefined;
    if (kiste && s.behaelter !== 1) {
      ziel = kiste.behaelter === 1 && kiste.status !== "ausgemustert" ? { p: kiste.platz_id, b: kiste.id } : kiste.platz_id ? { p: kiste.platz_id, b: null } : null;
    } else if (s.stamm_platz_id && karte.get(s.stamm_platz_id)?.aktiv) {
      ziel = { p: s.stamm_platz_id, b: null };
    }
    if (!ziel) {
      ohne.push({ id: s.id, code: s.code, name: s.name });
    } else if (s.platz_id === ziel.p && s.in_behaelter_id === ziel.b) {
      schonDort++;
    } else {
      bewegungen.push({ s: s.id, ...ziel });
    }
  }
  const vorgang = crypto.randomUUID();
  if (bewegungen.length) {
    const erstes = stuecke.find((s) => s.id === bewegungen[0]!.s)!;
    const ziel = bewegungen[0]!.p ? platzPfad(karte, bewegungen[0]!.p) : "–";
    await c.env.DB.batch(
      umbuchenStatements(c, karte, {
        vorgang,
        bewegungen,
        stuecke,
        aktion: "zurueckgeraeumt",
        notiz: "Zurückgeräumt",
        stamm: "nie",
        text:
          bewegungen.length === 1
            ? `Zurückgeräumt: „${erstes.name}“ (${erstes.code}) → ${ziel}`
            : `Zurückgeräumt: ${bewegungen.length} Stücke an ihren Stammplatz`,
      }),
    );
  }
  return c.json({
    vorgang_id: bewegungen.length ? vorgang : null,
    gebucht: bewegungen.length,
    schon_dort: schonDort,
    ohne_stammplatz: ohne,
  });
});

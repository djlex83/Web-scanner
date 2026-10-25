import { Hono } from "hono";
import { plusMonate } from "../../gemeinsam/datum";
import { pruefungLoeschenSchema, pruefungSchema } from "../../gemeinsam/schemas";
import { PRUEF_ERGEBNIS_NAME } from "../../gemeinsam/typen";
import { deDatum } from "../csv";
import { plaetzeLaden, STUECK_SELECT, zuStueck, type StueckZeile } from "../db/abfragen";
import { benutzerVon, braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";

export const pruefungenRouten = new Hono<AppEnv>();

/** Alle Stücke mit Prüftermin, früheste zuerst. */
pruefungenRouten.get("/", braucht("abfragen"), async (c) => {
  const karte = await plaetzeLaden(c.env.DB);
  const { results } = await c.env.DB.prepare(
    `${STUECK_SELECT} WHERE s.pruef_naechste IS NOT NULL AND s.status != 'ausgemustert'
     ORDER BY s.pruef_naechste, s.name COLLATE NOCASE LIMIT 1000`,
  ).all<StueckZeile>();
  return c.json(results.map((z) => zuStueck(karte, z)));
});

/** Ohne eigenes Intervall wird der nächste Termin 1 Jahr nach der Prüfung angesetzt. */
export const STANDARD_INTERVALL = 12;

/** Prüfung eintragen; der nächste Termin ergibt sich aus dem Intervall, falls nicht angegeben. */
pruefungenRouten.post("/", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, pruefungSchema);
  const s = await c.env.DB.prepare(
    "SELECT id, code, name, status, pruef_art, pruef_intervall, pruef_naechste FROM stuecke WHERE id = ?",
  )
    .bind(e.stueck_id)
    .first<{
      id: number;
      code: string;
      name: string;
      status: string;
      pruef_art: string | null;
      pruef_intervall: number | null;
      pruef_naechste: string | null;
    }>();
  if (!s) fehler(404, "Stück nicht gefunden");
  if (s.status === "ausgemustert") fehler(400, `„${s.name}“ ist ausgemustert`);
  // weggelassen = Prüfdatum + Intervall (Standard 1 Jahr); null = bewusst kein weiterer Termin
  const naechste = e.naechste === undefined ? plusMonate(e.datum, s.pruef_intervall ?? STANDARD_INTERVALL) : e.naechste;
  const defekt = e.ergebnis === "nicht_bestanden" && s.status === "vorhanden";
  const zeit = jetzt();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO pruefungen (stueck_id, datum, ergebnis, notiz, naechste, benutzer_id, erfasst_am, vorher_naechste, vorher_gespeichert)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    ).bind(s.id, e.datum, e.ergebnis, e.notiz, naechste, ich.id, zeit, s.pruef_naechste),
    c.env.DB.prepare(
      `UPDATE stuecke SET pruef_naechste = ?, status = CASE WHEN ? THEN 'defekt' ELSE status END, geaendert_am = ? WHERE id = ?`,
    ).bind(naechste, defekt ? 1 : 0, zeit, s.id),
    protokollEintrag(c, {
      aktion: "geprueft",
      objekt_typ: "stueck",
      objekt_id: s.id,
      text:
        `${s.pruef_art ?? "Prüfung"} „${s.name}“ (${s.code}) am ${deDatum(e.datum)}: ${PRUEF_ERGEBNIS_NAME[e.ergebnis]}` +
        (naechste ? `, nächste ${deDatum(naechste)}` : "") +
        (defekt ? " – als defekt markiert" : ""),
      nachher: { datum: e.datum, ergebnis: e.ergebnis, notiz: e.notiz, naechste },
    }),
  ]);
  const karte = await plaetzeLaden(c.env.DB);
  const z = await c.env.DB.prepare(`${STUECK_SELECT} WHERE s.id = ?`).bind(s.id).first<StueckZeile>();
  return c.json(zuStueck(karte, z!), 201);
});

/**
 * Prüfung löschen (ab Leitung): wird als gelöscht markiert und verschwindet aus der App,
 * der Nachweis bleibt in der Datenbank und im Protokoll. War es die letzte Prüfung,
 * gilt wieder der Termin von davor.
 */
pruefungenRouten.post("/:id{[0-9]+}/loeschen", braucht("pruefungen_loeschen"), async (c) => {
  const ich = benutzerVon(c);
  const id = Number(c.req.param("id"));
  const { grund } = await eingabe(c, pruefungLoeschenSchema);
  const p = await c.env.DB.prepare(
    `SELECT p.id, p.stueck_id, p.datum, p.ergebnis, p.notiz, p.naechste, p.geloescht_am, p.vorher_naechste, p.vorher_gespeichert,
            s.code, s.name, s.pruef_art, s.pruef_naechste
     FROM pruefungen p JOIN stuecke s ON s.id = p.stueck_id WHERE p.id = ?`,
  )
    .bind(id)
    .first<{
      id: number;
      stueck_id: number;
      datum: string;
      ergebnis: keyof typeof PRUEF_ERGEBNIS_NAME;
      notiz: string | null;
      naechste: string | null;
      geloescht_am: string | null;
      vorher_naechste: string | null;
      vorher_gespeichert: number;
      code: string;
      name: string;
      pruef_art: string | null;
      pruef_naechste: string | null;
    }>();
  if (!p) fehler(404, "Prüfung nicht gefunden");
  if (p.geloescht_am) fehler(409, "Diese Prüfung wurde schon gelöscht");

  // Nur wenn die gelöschte Prüfung die neueste ist, den Termin zurücksetzen
  const neuere = await c.env.DB.prepare(
    "SELECT naechste FROM pruefungen WHERE stueck_id = ? AND geloescht_am IS NULL AND id != ? ORDER BY datum DESC, id DESC LIMIT 1",
  )
    .bind(p.stueck_id, p.id)
    .first<{ naechste: string | null }>();
  const istNeueste = !(await c.env.DB.prepare(
    "SELECT 1 FROM pruefungen WHERE stueck_id = ? AND geloescht_am IS NULL AND id != ? AND (datum > ? OR (datum = ? AND id > ?))",
  )
    .bind(p.stueck_id, p.id, p.datum, p.datum, p.id)
    .first());
  const termin = istNeueste
    ? p.vorher_gespeichert
      ? p.vorher_naechste
      : (neuere?.naechste ?? p.pruef_naechste)
    : p.pruef_naechste;

  const zeit = jetzt();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE pruefungen SET geloescht_am = ?, geloescht_von_id = ?, loeschgrund = ? WHERE id = ?").bind(
      zeit,
      ich.id,
      grund,
      p.id,
    ),
    c.env.DB.prepare("UPDATE stuecke SET pruef_naechste = ?, geaendert_am = ? WHERE id = ?").bind(termin, zeit, p.stueck_id),
    protokollEintrag(c, {
      aktion: "pruefung_geloescht",
      objekt_typ: "stueck",
      objekt_id: p.stueck_id,
      text:
        `${p.pruef_art ?? "Prüfung"} vom ${deDatum(p.datum)} bei „${p.name}“ (${p.code}) gelöscht` +
        (grund ? `: ${grund}` : "") +
        (termin !== p.pruef_naechste ? ` – nächste Prüfung wieder ${deDatum(termin) || "offen"}` : ""),
      vorher: { datum: p.datum, ergebnis: p.ergebnis, notiz: p.notiz, naechste: p.naechste },
      nachher: { geloescht: true, grund, pruef_naechste: termin },
    }),
  ]);
  return c.json({ geloescht: true, pruef_naechste: termin });
});

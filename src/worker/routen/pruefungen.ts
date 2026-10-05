import { Hono } from "hono";
import { plusMonate } from "../../gemeinsam/datum";
import { pruefungSchema } from "../../gemeinsam/schemas";
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

/** Prüfung eintragen; der nächste Termin ergibt sich aus dem Intervall, falls nicht angegeben. */
pruefungenRouten.post("/", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, pruefungSchema);
  const s = await c.env.DB.prepare("SELECT id, code, name, status, pruef_art, pruef_intervall FROM stuecke WHERE id = ?")
    .bind(e.stueck_id)
    .first<{ id: number; code: string; name: string; status: string; pruef_art: string | null; pruef_intervall: number | null }>();
  if (!s) fehler(404, "Stück nicht gefunden");
  if (s.status === "ausgemustert") fehler(400, `„${s.name}“ ist ausgemustert`);
  const naechste = e.naechste ?? (s.pruef_intervall ? plusMonate(e.datum, s.pruef_intervall) : null);
  const defekt = e.ergebnis === "nicht_bestanden" && s.status === "vorhanden";
  const zeit = jetzt();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO pruefungen (stueck_id, datum, ergebnis, notiz, naechste, benutzer_id, erfasst_am) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(s.id, e.datum, e.ergebnis, e.notiz, naechste, ich.id, zeit),
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

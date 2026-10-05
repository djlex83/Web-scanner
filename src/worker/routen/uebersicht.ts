import { Hono } from "hono";
import { heute as heutigesDatum, plusTage } from "../../gemeinsam/datum";
import type { Uebersicht } from "../../gemeinsam/typen";
import { NICHT_AM_STAMMPLATZ, plaetzeLaden } from "../db/abfragen";
import { braucht, protokollEintrag, type AppEnv } from "../kontext";
import { buchungenAbfragen } from "./buchungen";

/** Beginn des heutigen Tages nach deutscher Zeit, als UTC-Zeitstempel. */
function tagesbeginnBerlin(): string {
  const nun = new Date();
  const datum = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(nun);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" })
    .formatToParts(nun)
    .find((t) => t.type === "timeZoneName")?.value;
  const versatz = name?.replace("GMT", "") || "+00:00";
  return new Date(`${datum}T00:00:00${versatz}`).toISOString();
}

export const uebersichtRouten = new Hono<AppEnv>();

uebersichtRouten.get("/", braucht("abfragen"), async (c) => {
  const db = c.env.DB;
  const heute = tagesbeginnBerlin();

  const [zahlen, bewegungen, karte] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM stuecke WHERE status != 'ausgemustert') AS stuecke,
          (SELECT COUNT(*) FROM stuecke WHERE status != 'ausgemustert' AND platz_id IS NULL) AS ohne_platz,
          (SELECT COUNT(*) FROM stuecke WHERE status = 'defekt') AS defekt,
          (SELECT COUNT(*) FROM plaetze WHERE aktiv = 1) AS plaetze,
          (SELECT COUNT(*) FROM stuecke WHERE vermisst_seit IS NOT NULL AND status != 'ausgemustert') AS vermisst,
          (SELECT COUNT(*) FROM ausleihen WHERE zurueck_am IS NULL) AS verliehen,
          (SELECT COUNT(*) FROM ausleihen WHERE zurueck_am IS NULL AND bis < ?1) AS verliehen_ueberfaellig,
          (SELECT COUNT(*) FROM stuecke WHERE pruef_naechste < ?1 AND status != 'ausgemustert') AS pruefung_ueberfaellig,
          (SELECT COUNT(*) FROM stuecke WHERE pruef_naechste >= ?1 AND pruef_naechste <= ?2 AND status != 'ausgemustert') AS pruefung_bald,
          (SELECT COUNT(*) FROM stuecke s WHERE s.status != 'ausgemustert' AND ${NICHT_AM_STAMMPLATZ}) AS nicht_am_stammplatz`,
      )
      .bind(heutigesDatum(), plusTage(heutigesDatum(), 30))
      .first<Omit<Uebersicht, "bewegungen_heute" | "letzte">>(),
    db.prepare("SELECT COUNT(*) AS n FROM buchungen WHERE zeitpunkt >= ?").bind(heute).first<{ n: number }>(),
    plaetzeLaden(db),
  ]);
  const letzte = await buchungenAbfragen(db, karte, { limit: 8 });
  const antwort: Uebersicht = {
    stuecke: zahlen?.stuecke ?? 0,
    ohne_platz: zahlen?.ohne_platz ?? 0,
    defekt: zahlen?.defekt ?? 0,
    plaetze: zahlen?.plaetze ?? 0,
    vermisst: zahlen?.vermisst ?? 0,
    verliehen: zahlen?.verliehen ?? 0,
    verliehen_ueberfaellig: zahlen?.verliehen_ueberfaellig ?? 0,
    pruefung_ueberfaellig: zahlen?.pruefung_ueberfaellig ?? 0,
    pruefung_bald: zahlen?.pruefung_bald ?? 0,
    nicht_am_stammplatz: zahlen?.nicht_am_stammplatz ?? 0,
    bewegungen_heute: bewegungen?.n ?? 0,
    letzte: letzte.eintraege,
  };
  return c.json(antwort);
});

/** Datensicherung als JSON (ohne Passwort-Hashes, Sitzungen und Fotos). */
uebersichtRouten.get("/sicherung", braucht("sicherung"), async (c) => {
  const db = c.env.DB;
  const [benutzer, plaetze, stuecke, buchungen, protokoll, kategorien, ausleihen, pruefungen, inventuren] = await Promise.all([
    db.prepare("SELECT id, benutzername, name, rolle, aktiv, erstellt_am, letzte_anmeldung FROM benutzer").all(),
    db.prepare("SELECT * FROM plaetze").all(),
    db.prepare("SELECT * FROM stuecke").all(),
    db.prepare("SELECT * FROM buchungen").all(),
    db.prepare("SELECT id, zeitpunkt, benutzer_id, aktion, objekt_typ, objekt_id, text, vorher_json, nachher_json FROM protokoll").all(),
    db.prepare("SELECT * FROM kategorien").all(),
    db.prepare("SELECT * FROM ausleihen").all(),
    db.prepare("SELECT * FROM pruefungen").all(),
    db.prepare("SELECT * FROM inventuren").all(),
  ]);
  await protokollEintrag(c, {
    aktion: "sicherung",
    objekt_typ: "system",
    text: "Datensicherung heruntergeladen",
  }).run();
  const tag = new Date().toISOString().slice(0, 10);
  return c.json(
    {
      erstellt_am: new Date().toISOString(),
      benutzer: benutzer.results,
      plaetze: plaetze.results,
      stuecke: stuecke.results,
      buchungen: buchungen.results,
      protokoll: protokoll.results,
      kategorien: kategorien.results,
      ausleihen: ausleihen.results,
      pruefungen: pruefungen.results,
      inventuren: inventuren.results,
    },
    200,
    { "content-disposition": `attachment; filename="web-scanner-sicherung-${tag}.json"` },
  );
});

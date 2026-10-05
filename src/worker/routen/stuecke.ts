import { Hono } from "hono";
import { istPlatzCode, normalisiereCode, zufallsKennung } from "../../gemeinsam/codes";
import { heute, plusTage } from "../../gemeinsam/datum";
import { stammplatzSchema, stueckAendernSchema, stueckAnlegenSchema } from "../../gemeinsam/schemas";
import { STATUS_NAME, type Ausleihe, type Pruefung, type Seite, type Stueck } from "../../gemeinsam/typen";
import { csv, csvAntwort, deDatum, ortszeit } from "../csv";
import {
  alsJson,
  NICHT_AM_STAMMPLATZ,
  platzMitUnterplaetzen,
  platzPfad,
  plaetzeLaden,
  STUECK_SELECT,
  zuStueck,
  type PlatzKarte,
  type StueckZeile,
} from "../db/abfragen";
import { stueckeLaden } from "../db/bewegen";
import { braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv, type Ctx } from "../kontext";
import { ausleihenAbfragen } from "./ausleihen";
import { buchungenAbfragen } from "./buchungen";

export const stueckeRouten = new Hono<AppEnv>();

const SEITE = 50;
const CSV_MAX = 20_000;
export const BEHAELTER_PRAEFIX = "KISTE-";

/** Filter aus der Adresse – gemeinsam für Liste und Export. */
function filterLesen(c: Ctx, karte: PlatzKarte): { wo: string; werte: (string | number)[] } {
  const q = c.req.query("q")?.trim() ?? "";
  const status = c.req.query("status") ?? "";
  const platz = c.req.query("platz") ?? "";
  const merkmal = c.req.query("merkmal") ?? "";
  const ids = (c.req.query("ids") ?? "").split(",").filter((i) => /^[0-9]+$/.test(i)).map(Number);

  const bed: string[] = [];
  const werte: (string | number)[] = [];
  if (q) {
    const muster = `%${q.replace(/[\\%_]/g, (z) => "\\" + z)}%`;
    bed.push("(s.name LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\' OR s.kategorie LIKE ? ESCAPE '\\')");
    werte.push(muster, muster, muster);
  }
  if (ids.length) {
    bed.push("s.id IN (SELECT value FROM json_each(?))");
    werte.push(alsJson(ids.slice(0, 500)));
  }
  if (status === "alle" || ids.length) {
    // keine Einschränkung
  } else if (status === "vorhanden" || status === "defekt" || status === "ausgemustert") {
    bed.push("s.status = ?");
    werte.push(status);
  } else {
    bed.push("s.status != 'ausgemustert'");
  }
  if (platz === "ohne") {
    bed.push("s.platz_id IS NULL");
  } else if (/^[0-9]+$/.test(platz)) {
    bed.push("s.platz_id IN (SELECT value FROM json_each(?))");
    werte.push(alsJson(platzMitUnterplaetzen(karte, Number(platz))));
  }
  switch (merkmal) {
    case "vermisst":
      bed.push("s.vermisst_seit IS NOT NULL");
      break;
    case "verliehen":
      bed.push("a.id IS NOT NULL");
      break;
    case "ueberfaellig":
      bed.push("a.bis < ?");
      werte.push(heute());
      break;
    case "pruefung":
      bed.push("s.pruef_naechste <= ?");
      werte.push(plusTage(heute(), 30));
      break;
    case "behaelter":
      bed.push("s.behaelter = 1");
      break;
    case "ohne_inventur":
      bed.push("s.inventur = 0");
      break;
    case "fremd":
      bed.push(NICHT_AM_STAMMPLATZ);
      break;
  }
  return { wo: bed.length ? `WHERE ${bed.join(" AND ")}` : "", werte };
}

stueckeRouten.get("/", braucht("abfragen"), async (c) => {
  const seite = Math.max(0, Number(c.req.query("seite") ?? 0) || 0);
  const karte = await plaetzeLaden(c.env.DB);
  const { wo, werte } = filterLesen(c, karte);
  const { results } = await c.env.DB.prepare(
    `${STUECK_SELECT} ${wo} ORDER BY s.name COLLATE NOCASE, s.id LIMIT ? OFFSET ?`,
  )
    .bind(...werte, SEITE + 1, seite * SEITE)
    .all<StueckZeile>();
  const antwort: Seite<Stueck> = {
    eintraege: results.slice(0, SEITE).map((z) => zuStueck(karte, z)),
    weitere: results.length > SEITE,
  };
  return c.json(antwort);
});

/** Bestand als CSV für Excel – mit denselben Filtern wie die Liste. */
stueckeRouten.get("/csv", braucht("abfragen"), async (c) => {
  const karte = await plaetzeLaden(c.env.DB);
  const { wo, werte } = filterLesen(c, karte);
  const { results } = await c.env.DB.prepare(`${STUECK_SELECT} ${wo} ORDER BY s.name COLLATE NOCASE, s.id LIMIT ?`)
    .bind(...werte, CSV_MAX)
    .all<StueckZeile>();
  const ja = (b: boolean) => (b ? "ja" : "nein");
  return csvAntwort(
    c,
    "bestand",
    csv(
      [
        "Code", "Name", "Kategorie", "Status", "Platz", "Abteilung", "Im Behälter", "Stammplatz", "Am Stammplatz", "Ist Behälter", "Inhalt",
        "Inventur", "Vermisst seit", "Verliehen an", "Rückgabe bis", "Prüfung", "Prüfintervall (Monate)",
        "Nächste Prüfung", "Zuletzt bewegt", "Bewegt von", "Erfasst", "Beschreibung",
      ],
      results.map((z) => {
        const s = zuStueck(karte, z);
        return [
          s.code,
          s.name,
          s.kategorie,
          STATUS_NAME[s.status],
          s.platz?.pfad ?? "",
          s.platz ? (s.platz.pfad.split(" › ")[0] ?? "") : "",
          s.in_behaelter?.name ?? "",
          [s.stammplatz?.pfad, s.stamm_behaelter?.name].filter(Boolean).join(" › "),
          s.am_stammplatz === null ? "" : ja(s.am_stammplatz),
          ja(s.behaelter),
          s.behaelter ? s.inhalt : "",
          ja(s.inventur),
          s.vermisst_seit ? ortszeit.format(new Date(s.vermisst_seit)) : "",
          s.ausleihe?.an ?? "",
          deDatum(s.ausleihe?.bis ?? null),
          s.pruefung.art,
          s.pruefung.intervall,
          deDatum(s.pruefung.naechste),
          s.bewegt_am ? ortszeit.format(new Date(s.bewegt_am)) : "",
          s.bewegt_von,
          ortszeit.format(new Date(s.erstellt_am)),
          s.beschreibung,
        ];
      }),
    ),
  );
});

stueckeRouten.get("/:id{[0-9]+}", braucht("abfragen"), async (c) => {
  const id = Number(c.req.param("id"));
  const karte = await plaetzeLaden(c.env.DB);
  const z = await c.env.DB.prepare(`${STUECK_SELECT} WHERE s.id = ?`).bind(id).first<StueckZeile>();
  if (!z) fehler(404, "Stück nicht gefunden");
  const [verlauf, pruefungen, ausleihen, inhalt] = await Promise.all([
    buchungenAbfragen(c.env.DB, karte, { stueck_id: id, limit: 200 }),
    c.env.DB.prepare(
      `SELECT p.id, p.datum, p.ergebnis, p.notiz, p.naechste, u.name AS benutzer
       FROM pruefungen p JOIN benutzer u ON u.id = p.benutzer_id
       WHERE p.stueck_id = ? ORDER BY p.datum DESC, p.id DESC LIMIT 50`,
    )
      .bind(id)
      .all<Pruefung>(),
    ausleihenAbfragen(c.env.DB, karte, { stueck_id: id, limit: 20 }),
    z.behaelter === 1
      ? c.env.DB.prepare(`${STUECK_SELECT} WHERE s.in_behaelter_id = ? AND s.status != 'ausgemustert' ORDER BY s.name COLLATE NOCASE`)
          .bind(id)
          .all<StueckZeile>()
      : null,
  ]);
  return c.json({
    stueck: zuStueck(karte, z),
    verlauf: verlauf.eintraege,
    pruefungen: pruefungen.results,
    ausleihen: ausleihen satisfies Ausleihe[],
    inhalt: inhalt?.results.map((i) => zuStueck(karte, i)) ?? [],
  });
});

stueckeRouten.post("/", braucht("erfassen"), async (c) => {
  const e = await eingabe(c, stueckAnlegenSchema);
  let code = e.code ? normalisiereCode(e.code) : "";
  if (e.code && !code) fehler(400, "Code fehlt");
  if (!code) code = BEHAELTER_PRAEFIX + zufallsKennung(8);
  if (istPlatzCode(code)) fehler(400, "Das ist ein Platz-Code, kein Stück");
  const vorhanden = await c.env.DB.prepare("SELECT name FROM stuecke WHERE code = ?")
    .bind(code)
    .first<{ name: string }>();
  if (vorhanden) fehler(409, `Code ist schon vergeben an „${vorhanden.name}“`);

  const karte = await plaetzeLaden(c.env.DB);
  let platzId = e.platz_id ?? null;
  let kisteId: number | null = null;
  let kisteName = "";
  if (e.in_behaelter_id) {
    if (e.behaelter) fehler(400, "Ein Behälter kann nicht in einen Behälter");
    const [k] = await stueckeLaden(c.env.DB, [e.in_behaelter_id]);
    if (!k || k.behaelter !== 1 || k.status === "ausgemustert") fehler(400, "Behälter nicht gefunden");
    platzId = k.platz_id;
    kisteId = k.id;
    kisteName = k.name;
  } else if (platzId) {
    const p = karte.get(platzId);
    if (!p || !p.aktiv) fehler(400, "Platz nicht gefunden");
  }
  const zeit = jetzt();
  const ich = c.get("benutzer")!;
  const gebucht = platzId !== null || kisteId !== null;
  const ort = [platzId ? platzPfad(karte, platzId) : "", kisteName && `Behälter „${kisteName}“`].filter(Boolean).join(" › ");
  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO stuecke (code, name, kategorie, beschreibung, platz_id, in_behaelter_id, stamm_platz_id, stamm_behaelter_id,
                            behaelter, inventur, bewegt_am, bewegt_von_id, erstellt_am, geaendert_am)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      code,
      e.name,
      e.kategorie,
      e.beschreibung,
      platzId,
      kisteId,
      // erster Ort = Stammplatz
      kisteId ? null : platzId,
      kisteId,
      e.behaelter ? 1 : 0,
      e.inventur ? 1 : 0,
      gebucht ? zeit : null,
      gebucht ? ich.id : null,
      zeit,
      zeit,
    ),
  ];
  if (gebucht) {
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO buchungen (vorgang_id, stueck_id, von_platz_id, nach_platz_id, nach_behaelter_id, art, benutzer_id, zeitpunkt)
         SELECT ?, id, NULL, ?, ?, 'erfassen', ?, ? FROM stuecke WHERE code = ?`,
      ).bind(crypto.randomUUID(), platzId, kisteId, ich.id, zeit, code),
    );
  }
  stmts.push(
    c.env.DB.prepare(
      `INSERT INTO protokoll (zeitpunkt, benutzer_id, aktion, objekt_typ, objekt_id, text, nachher_json, geraet)
       SELECT ?, ?, 'stueck_erfasst', 'stueck', id, ?, ?, ? FROM stuecke WHERE code = ?`,
    ).bind(
      zeit,
      ich.id,
      `${e.behaelter ? "Behälter" : "Stück"} „${e.name}“ (${code}) erfasst${ort ? ` → ${ort}` : ""}`,
      JSON.stringify({
        code,
        name: e.name,
        kategorie: e.kategorie,
        platz_id: platzId,
        in_behaelter_id: kisteId,
        behaelter: e.behaelter,
        inventur: e.inventur,
      }),
      c.req.header("user-agent")?.slice(0, 200) ?? null,
      code,
    ),
  );
  await c.env.DB.batch(stmts);
  const z = await c.env.DB.prepare(`${STUECK_SELECT} WHERE s.code = ?`).bind(code).first<StueckZeile>();
  return c.json(zuStueck(karte, z!), 201);
});

stueckeRouten.patch("/:id{[0-9]+}", braucht("stuecke_verwalten"), async (c) => {
  const id = Number(c.req.param("id"));
  const e = await eingabe(c, stueckAendernSchema);
  const karte = await plaetzeLaden(c.env.DB);
  const alt = await c.env.DB.prepare(`${STUECK_SELECT} WHERE s.id = ?`).bind(id).first<StueckZeile>();
  if (!alt) fehler(404, "Stück nicht gefunden");

  const wahl = <T,>(neu: T | undefined, bisher: T) => (neu !== undefined ? neu : bisher);
  const neu = {
    name: e.name ?? alt.name,
    kategorie: wahl(e.kategorie, alt.kategorie),
    beschreibung: wahl(e.beschreibung, alt.beschreibung),
    status: e.status ?? alt.status,
    behaelter: e.behaelter ?? alt.behaelter === 1,
    inventur: e.inventur ?? alt.inventur === 1,
    pruef_art: wahl(e.pruef_art, alt.pruef_art),
    pruef_intervall: wahl(e.pruef_intervall, alt.pruef_intervall) ?? null,
    pruef_naechste: wahl(e.pruef_naechste, alt.pruef_naechste) ?? null,
  };
  if (!neu.behaelter && alt.behaelter === 1 && alt.inhalt > 0) {
    fehler(409, `Im Behälter liegen noch ${alt.inhalt} Stücke. Bitte zuerst umbuchen.`);
  }
  if (neu.behaelter && alt.behaelter !== 1 && alt.in_behaelter_id) {
    fehler(409, "Das Stück liegt selbst in einem Behälter und kann deshalb kein Behälter sein");
  }
  if (neu.status === "ausgemustert" && alt.status !== "ausgemustert" && alt.inhalt > 0) {
    fehler(409, `Im Behälter liegen noch ${alt.inhalt} Stücke. Bitte zuerst umbuchen.`);
  }

  const aenderungen: string[] = [];
  if (neu.name !== alt.name) aenderungen.push(`Name „${alt.name}“ → „${neu.name}“`);
  if (neu.kategorie !== alt.kategorie) aenderungen.push(`Kategorie → „${neu.kategorie ?? "–"}“`);
  if (neu.beschreibung !== alt.beschreibung) aenderungen.push("Beschreibung geändert");
  if (neu.status !== alt.status) aenderungen.push(`Status ${STATUS_NAME[alt.status]} → ${STATUS_NAME[neu.status]}`);
  if (neu.behaelter !== (alt.behaelter === 1)) aenderungen.push(neu.behaelter ? "ist jetzt ein Behälter" : "ist kein Behälter mehr");
  if (neu.inventur !== (alt.inventur === 1)) aenderungen.push(neu.inventur ? "inventurpflichtig" : "nicht inventurpflichtig");
  if (neu.pruef_art !== alt.pruef_art) aenderungen.push(`Prüfung „${neu.pruef_art ?? "–"}“`);
  if (neu.pruef_intervall !== alt.pruef_intervall) {
    aenderungen.push(neu.pruef_intervall ? `Prüfintervall ${neu.pruef_intervall} Monate` : "kein Prüfintervall");
  }
  if (neu.pruef_naechste !== alt.pruef_naechste) aenderungen.push(`nächste Prüfung ${deDatum(neu.pruef_naechste) || "–"}`);
  if (aenderungen.length) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE stuecke SET name = ?, kategorie = ?, beschreibung = ?, status = ?, behaelter = ?, inventur = ?,
                pruef_art = ?, pruef_intervall = ?, pruef_naechste = ?, geaendert_am = ?,
                -- ein Behälter liegt nie in einem Behälter: Stammplatz wird der Platz des alten Behälters
                stamm_platz_id = CASE WHEN ? = 1 AND stamm_behaelter_id IS NOT NULL
                  THEN (SELECT k.platz_id FROM stuecke k WHERE k.id = stuecke.stamm_behaelter_id) ELSE stamm_platz_id END,
                stamm_behaelter_id = CASE WHEN ? = 1 THEN NULL ELSE stamm_behaelter_id END
         WHERE id = ?`,
      ).bind(
        neu.name,
        neu.kategorie,
        neu.beschreibung,
        neu.status,
        neu.behaelter ? 1 : 0,
        neu.inventur ? 1 : 0,
        neu.pruef_art,
        neu.pruef_intervall,
        neu.pruef_naechste,
        jetzt(),
        neu.behaelter ? 1 : 0,
        neu.behaelter ? 1 : 0,
        id,
      ),
      protokollEintrag(c, {
        aktion: "stueck_geaendert",
        objekt_typ: "stueck",
        objekt_id: id,
        text: `${neu.behaelter ? "Behälter" : "Stück"} „${neu.name}“ (${alt.code}): ${aenderungen.join(", ")}`,
        vorher: {
          name: alt.name,
          kategorie: alt.kategorie,
          beschreibung: alt.beschreibung,
          status: alt.status,
          behaelter: alt.behaelter === 1,
          inventur: alt.inventur === 1,
          pruef_art: alt.pruef_art,
          pruef_intervall: alt.pruef_intervall,
          pruef_naechste: alt.pruef_naechste,
        },
        nachher: neu,
      }),
    ]);
  }
  const z = await c.env.DB.prepare(`${STUECK_SELECT} WHERE s.id = ?`).bind(id).first<StueckZeile>();
  return c.json(zuStueck(karte, z!));
});

/** Stammplatz festlegen: Platz, Behälter, den aktuellen Ort – oder entfernen. */
stueckeRouten.post("/stammplatz", braucht("buchen"), async (c) => {
  const e = await eingabe(c, stammplatzSchema);
  const ids = [...new Set(e.stueck_ids)];
  const stuecke = await stueckeLaden(c.env.DB, ids);
  if (stuecke.length !== ids.length) fehler(400, "Mindestens ein Stück wurde nicht gefunden");
  const karte = await plaetzeLaden(c.env.DB);
  let stmt: D1PreparedStatement;
  let ziel: string;
  if (e.aktuell) {
    // Behälter selbst liegen nie in Behältern – für sie zählt nur der Platz
    stmt = c.env.DB.prepare(
      `UPDATE stuecke SET stamm_platz_id = CASE WHEN in_behaelter_id IS NULL OR behaelter = 1 THEN platz_id END,
              stamm_behaelter_id = CASE WHEN behaelter = 1 THEN NULL ELSE in_behaelter_id END
       WHERE id IN (SELECT value FROM json_each(?))`,
    ).bind(alsJson(ids));
    ziel = "aktueller Ort";
  } else if (e.platz_id) {
    const p = karte.get(e.platz_id);
    if (!p || !p.aktiv) fehler(400, "Platz nicht gefunden");
    stmt = c.env.DB.prepare(
      "UPDATE stuecke SET stamm_platz_id = ?, stamm_behaelter_id = NULL WHERE id IN (SELECT value FROM json_each(?))",
    ).bind(p.id, alsJson(ids));
    ziel = platzPfad(karte, p.id);
  } else if (e.behaelter_id) {
    const [k] = await stueckeLaden(c.env.DB, [e.behaelter_id]);
    if (!k || k.behaelter !== 1 || k.status === "ausgemustert") fehler(400, "Behälter nicht gefunden");
    const kiste = stuecke.find((s) => s.behaelter === 1 || s.id === k.id);
    if (kiste) fehler(400, `„${kiste.name}“ kann nicht in einem Behälter liegen`);
    stmt = c.env.DB.prepare(
      "UPDATE stuecke SET stamm_platz_id = NULL, stamm_behaelter_id = ? WHERE id IN (SELECT value FROM json_each(?))",
    ).bind(k.id, alsJson(ids));
    ziel = `Behälter „${k.name}“`;
  } else {
    stmt = c.env.DB.prepare(
      "UPDATE stuecke SET stamm_platz_id = NULL, stamm_behaelter_id = NULL WHERE id IN (SELECT value FROM json_each(?))",
    ).bind(alsJson(ids));
    ziel = "";
  }
  const wen = ids.length === 1 ? `„${stuecke[0]!.name}“ (${stuecke[0]!.code})` : `${ids.length} Stücke`;
  await c.env.DB.batch([
    stmt,
    protokollEintrag(c, {
      aktion: "stammplatz",
      objekt_typ: "stueck",
      objekt_id: ids.length === 1 ? ids[0] : null,
      text: ziel ? `Stammplatz für ${wen}: ${ziel}` : `Stammplatz für ${wen} entfernt`,
      vorher: stuecke.map((s) => ({ code: s.code, stamm_platz_id: s.stamm_platz_id, stamm_behaelter_id: s.stamm_behaelter_id })),
      nachher: { ziel: ziel || null },
    }),
  ]);
  const { results } = await c.env.DB.prepare(`${STUECK_SELECT} WHERE s.id IN (SELECT value FROM json_each(?))`)
    .bind(alsJson(ids))
    .all<StueckZeile>();
  return c.json(results.map((z) => zuStueck(karte, z)));
});

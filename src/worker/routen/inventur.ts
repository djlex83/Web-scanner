import { Hono } from "hono";
import { inventurSchema } from "../../gemeinsam/schemas";
import type { InventurEintrag, InventurErgebnis, StueckKurz } from "../../gemeinsam/typen";
import {
  alsJson,
  platzKurz,
  platzMitUnterplaetzen,
  platzPfad,
  plaetzeLaden,
  STUECK_SELECT,
  zuPlatz,
  zuStueck,
  type PlatzKarte,
  type StueckZeile,
} from "../db/abfragen";
import { stueckeLaden, type StueckOrt } from "../db/bewegen";
import { benutzerVon, braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";
import { umbuchenStatements } from "./buchungen";

export const inventurRouten = new Hono<AppEnv>();

interface InventurZeile {
  id: number;
  platz_id: number;
  benutzer: string;
  zeitpunkt: string;
  erwartet: number;
  gefunden: number;
  fehlend: number;
  zusaetzlich: number;
  verliehen: number;
}

async function inventurenAbfragen(db: D1Database, karte: PlatzKarte, platzId: number | null, limit: number): Promise<InventurEintrag[]> {
  const { results } = await db
    .prepare(
      `SELECT i.id, i.platz_id, u.name AS benutzer, i.zeitpunkt, i.erwartet, i.gefunden, i.fehlend, i.zusaetzlich, i.verliehen
       FROM inventuren i JOIN benutzer u ON u.id = i.benutzer_id
       ${platzId ? "WHERE i.platz_id = ?" : ""} ORDER BY i.id DESC LIMIT ?`,
    )
    .bind(...(platzId ? [platzId] : []), limit)
    .all<InventurZeile>();
  return results.map(({ platz_id, ...r }) => ({ ...r, platz: platzKurz(karte, platz_id) }));
}

inventurRouten.get("/", braucht("abfragen"), async (c) => {
  const karte = await plaetzeLaden(c.env.DB);
  return c.json(await inventurenAbfragen(c.env.DB, karte, null, 50));
});

/** Alles, was laut System auf dem Platz (und den Plätzen darunter) liegt. */
inventurRouten.get("/:id{[0-9]+}", braucht("buchen"), async (c) => {
  const id = Number(c.req.param("id"));
  const karte = await plaetzeLaden(c.env.DB);
  const p = karte.get(id);
  if (!p) fehler(404, "Platz nicht gefunden");
  const ids = platzMitUnterplaetzen(karte, id);
  const [{ results }, letzte] = await Promise.all([
    c.env.DB.prepare(
      `${STUECK_SELECT} WHERE s.platz_id IN (SELECT value FROM json_each(?)) AND s.status != 'ausgemustert'
       ORDER BY s.name COLLATE NOCASE LIMIT 2000`,
    )
      .bind(alsJson(ids))
      .all<StueckZeile>(),
    inventurenAbfragen(c.env.DB, karte, id, 10),
  ]);
  return c.json({
    platz: zuPlatz(karte, p, results.length),
    platz_ids: ids,
    stuecke: results.map((z) => zuStueck(karte, z)),
    letzte,
  });
});

const kurz = (s: StueckOrt): StueckKurz => ({ id: s.id, code: s.code, name: s.name });

/** Inventur abschließen: Soll/Ist vergleichen, auf Wunsch umbuchen und Fehlende als vermisst melden. */
inventurRouten.post("/", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, inventurSchema);
  const karte = await plaetzeLaden(c.env.DB);
  const platz = karte.get(e.platz_id);
  if (!platz || !platz.aktiv) fehler(400, "Platz nicht gefunden");
  const baum = new Set(platzMitUnterplaetzen(karte, platz.id));
  const pfad = platzPfad(karte, platz.id);

  const gescannt = (await stueckeLaden(c.env.DB, [...new Set(e.gefunden_ids)])).filter((s) => s.status !== "ausgemustert");
  const gefunden = new Set(gescannt.map((s) => s.id));
  const { results: hier } = await c.env.DB.prepare(
    `SELECT s.id, s.code, s.name, s.status, s.platz_id, s.in_behaelter_id, s.behaelter, s.vermisst_seit, s.inventur,
            s.stamm_platz_id, s.stamm_behaelter_id,
            EXISTS (SELECT 1 FROM ausleihen a WHERE a.stueck_id = s.id AND a.zurueck_am IS NULL) AS verliehen
     FROM stuecke s WHERE s.platz_id IN (SELECT value FROM json_each(?)) AND s.status != 'ausgemustert'`,
  )
    .bind(alsJson([...baum]))
    .all<StueckOrt & { inventur: number }>();
  // Ein gescannter Behälter zählt mitsamt Inhalt als gefunden
  for (const s of hier) if (s.in_behaelter_id && gefunden.has(s.in_behaelter_id)) gefunden.add(s.id);

  const erwartet = hier.filter((s) => s.inventur === 1);
  const verliehen = erwartet.filter((s) => s.verliehen && !gefunden.has(s.id));
  const fehlende = erwartet.filter((s) => !gefunden.has(s.id) && !s.verliehen);
  const zusaetzliche = gescannt.filter(
    (s) => !(s.platz_id !== null && baum.has(s.platz_id)) && !(s.in_behaelter_id && gefunden.has(s.in_behaelter_id)),
  );
  const wiedergefunden = hier.filter((s) => s.vermisst_seit && gefunden.has(s.id));
  const anzahlGefunden = erwartet.filter((s) => gefunden.has(s.id)).length;

  const zeit = jetzt();
  const vorgang = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [];
  const buchen = e.zusaetzliche_buchen && zusaetzliche.length > 0;
  if (buchen) {
    stmts.push(
      ...umbuchenStatements(c, karte, {
        vorgang,
        bewegungen: zusaetzliche.map((s) => ({ s: s.id, p: platz.id, b: null })),
        stuecke: zusaetzliche,
        objekt_id: platz.id,
        notiz: "Inventur",
        nachher: { nach: pfad },
        text: `Inventur: ${zusaetzliche.length === 1 ? `„${zusaetzliche[0]!.name}“` : `${zusaetzliche.length} Stücke`} → ${pfad}`,
      }),
    );
  }
  if (wiedergefunden.length) {
    stmts.push(
      c.env.DB.prepare("UPDATE stuecke SET vermisst_seit = NULL WHERE id IN (SELECT value FROM json_each(?))").bind(
        alsJson(wiedergefunden.map((s) => s.id)),
      ),
    );
  }
  const melden = e.fehlende_vermisst ? fehlende.filter((s) => !s.vermisst_seit) : [];
  if (melden.length) {
    stmts.push(
      c.env.DB.prepare("UPDATE stuecke SET vermisst_seit = ? WHERE id IN (SELECT value FROM json_each(?))").bind(
        zeit,
        alsJson(melden.map((s) => s.id)),
      ),
    );
  }
  const details = { fehlende: fehlende.map(kurz), zusaetzliche: zusaetzliche.map(kurz), verliehen: verliehen.map(kurz) };
  stmts.push(
    c.env.DB.prepare(
      `INSERT INTO inventuren (platz_id, benutzer_id, zeitpunkt, erwartet, gefunden, fehlend, zusaetzlich, verliehen, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(platz.id, ich.id, zeit, erwartet.length, anzahlGefunden, fehlende.length, zusaetzliche.length, verliehen.length, JSON.stringify(details)),
    protokollEintrag(c, {
      aktion: "inventur",
      objekt_typ: "platz",
      objekt_id: platz.id,
      text:
        `Inventur ${pfad}: ${anzahlGefunden} von ${erwartet.length} gefunden` +
        (fehlende.length ? `, ${fehlende.length} fehlen${melden.length ? " (als vermisst gemeldet)" : ""}` : "") +
        (zusaetzliche.length ? `, ${zusaetzliche.length} zusätzlich${buchen ? " (hierher gebucht)" : ""}` : "") +
        (verliehen.length ? `, ${verliehen.length} verliehen` : "") +
        (wiedergefunden.length ? `, ${wiedergefunden.length} vermisste wieder gefunden` : ""),
      nachher: details,
    }),
  );
  await c.env.DB.batch(stmts);

  const ergebnis: InventurErgebnis = {
    id: 0,
    platz: platzKurz(karte, platz.id),
    benutzer: ich.name,
    zeitpunkt: zeit,
    erwartet: erwartet.length,
    gefunden: anzahlGefunden,
    fehlend: fehlende.length,
    zusaetzlich: zusaetzliche.length,
    verliehen: verliehen.length,
    fehlende: details.fehlende,
    zusaetzliche: details.zusaetzliche,
    vorgang_id: buchen ? vorgang : null,
  };
  return c.json(ergebnis, 201);
});

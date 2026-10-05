import { Hono } from "hono";
import { neuerPlatzCode } from "../../gemeinsam/codes";
import { platzAendernSchema, platzAnlegenSchema } from "../../gemeinsam/schemas";
import { PLATZ_TYP_NAME, type PlatzTyp } from "../../gemeinsam/typen";
import {
  alsJson,
  platzMitUnterplaetzen,
  plaetzeLaden,
  STUECK_SELECT,
  zuPlatz,
  zuStueck,
  type StueckZeile,
} from "../db/abfragen";
import { braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";

export const plaetzeRouten = new Hono<AppEnv>();

const ELTERN_TYP: Record<PlatzTyp, PlatzTyp | null> = {
  abteilung: null,
  regal: "abteilung",
  fach: "regal",
};

async function anzahlen(db: D1Database): Promise<Map<number, number>> {
  const { results } = await db
    .prepare(
      "SELECT platz_id, COUNT(*) AS n FROM stuecke WHERE platz_id IS NOT NULL AND status != 'ausgemustert' GROUP BY platz_id",
    )
    .all<{ platz_id: number; n: number }>();
  return new Map(results.map((r) => [r.platz_id, r.n]));
}

plaetzeRouten.get("/", braucht("abfragen"), async (c) => {
  const [karte, n] = await Promise.all([plaetzeLaden(c.env.DB), anzahlen(c.env.DB)]);
  const alle = c.req.query("alle") === "1";
  const liste = [...karte.values()]
    .filter((p) => alle || p.aktiv === 1)
    .map((p) => zuPlatz(karte, p, n.get(p.id) ?? 0));
  return c.json(liste);
});

plaetzeRouten.get("/:id{[0-9]+}", braucht("abfragen"), async (c) => {
  const id = Number(c.req.param("id"));
  const [karte, n] = await Promise.all([plaetzeLaden(c.env.DB), anzahlen(c.env.DB)]);
  const p = karte.get(id);
  if (!p) fehler(404, "Platz nicht gefunden");
  const ids = platzMitUnterplaetzen(karte, id);
  const { results } = await c.env.DB.prepare(
    `${STUECK_SELECT} WHERE s.platz_id IN (SELECT value FROM json_each(?)) AND s.status != 'ausgemustert'
     ORDER BY s.name COLLATE NOCASE LIMIT 1000`,
  )
    .bind(alsJson(ids))
    .all<StueckZeile>();
  return c.json({
    platz: zuPlatz(karte, p, n.get(id) ?? 0),
    unterplaetze: [...karte.values()]
      .filter((u) => u.eltern_id === id)
      .map((u) => zuPlatz(karte, u, n.get(u.id) ?? 0)),
    stuecke: results.map((z) => zuStueck(karte, z)),
  });
});

plaetzeRouten.post("/", braucht("plaetze_verwalten"), async (c) => {
  const e = await eingabe(c, platzAnlegenSchema);
  const elternTyp = ELTERN_TYP[e.typ];
  let elternName = "";
  if (elternTyp) {
    if (!e.eltern_id) fehler(400, `Ein ${PLATZ_TYP_NAME[e.typ]} gehört zu einem ${PLATZ_TYP_NAME[elternTyp]}`);
    const el = await c.env.DB.prepare("SELECT name, typ, aktiv FROM plaetze WHERE id = ?")
      .bind(e.eltern_id)
      .first<{ name: string; typ: PlatzTyp; aktiv: number }>();
    if (!el || el.typ !== elternTyp || !el.aktiv) {
      fehler(400, `Bitte einen gültigen Platz vom Typ ${PLATZ_TYP_NAME[elternTyp]} wählen`);
    }
    elternName = el.name;
  } else if (e.eltern_id) {
    fehler(400, "Eine Abteilung liegt ganz oben");
  }
  const doppelt = await c.env.DB.prepare(
    "SELECT 1 FROM plaetze WHERE name = ? COLLATE NOCASE AND eltern_id IS ? AND aktiv = 1",
  )
    .bind(e.name, e.eltern_id ?? null)
    .first();
  if (doppelt) fehler(409, `„${e.name}“ gibt es hier schon`);

  for (let versuch = 0; versuch < 3; versuch++) {
    const code = neuerPlatzCode();
    try {
      const z = await c.env.DB.prepare(
        `INSERT INTO plaetze (code, name, typ, eltern_id, notiz, erstellt_am) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      )
        .bind(code, e.name, e.typ, e.eltern_id ?? null, e.notiz, jetzt())
        .first<{ id: number }>();
      const id = z!.id;
      await protokollEintrag(c, {
        aktion: "platz_angelegt",
        objekt_typ: "platz",
        objekt_id: id,
        text: `${PLATZ_TYP_NAME[e.typ]} „${e.name}“ angelegt${elternName ? ` in „${elternName}“` : ""}`,
        nachher: { name: e.name, typ: e.typ, eltern_id: e.eltern_id ?? null, code },
      }).run();
      const karte = await plaetzeLaden(c.env.DB);
      return c.json(zuPlatz(karte, karte.get(id)!, 0), 201);
    } catch (err) {
      if (!String(err).includes("UNIQUE")) throw err;
    }
  }
  fehler(409, "Bitte erneut versuchen");
});

plaetzeRouten.patch("/:id{[0-9]+}", braucht("plaetze_verwalten"), async (c) => {
  const id = Number(c.req.param("id"));
  const e = await eingabe(c, platzAendernSchema);
  const karte = await plaetzeLaden(c.env.DB);
  const alt = karte.get(id);
  if (!alt) fehler(404, "Platz nicht gefunden");

  const name = e.name ?? alt.name;
  const notiz = e.notiz !== undefined ? e.notiz : alt.notiz;
  const aktiv = e.aktiv ?? alt.aktiv === 1;
  if (!aktiv && alt.aktiv === 1) {
    const ids = platzMitUnterplaetzen(karte, id);
    const belegt = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM stuecke WHERE platz_id IN (SELECT value FROM json_each(?)) AND status != 'ausgemustert'",
    )
      .bind(alsJson(ids))
      .first<{ n: number }>();
    if (belegt?.n) fehler(409, `Hier liegen noch ${belegt.n} Stücke. Bitte zuerst umbuchen.`);
    if (ids.length > 1 && [...karte.values()].some((u) => u.eltern_id === id && u.aktiv === 1)) {
      fehler(409, "Bitte zuerst die Plätze darunter deaktivieren");
    }
  }
  const aenderungen: string[] = [];
  if (name !== alt.name) aenderungen.push(`Name „${alt.name}“ → „${name}“`);
  if (notiz !== alt.notiz) aenderungen.push("Notiz geändert");
  if (aktiv !== (alt.aktiv === 1)) aenderungen.push(aktiv ? "aktiviert" : "deaktiviert");
  if (aenderungen.length) {
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE plaetze SET name = ?, notiz = ?, aktiv = ? WHERE id = ?").bind(
        name,
        notiz,
        aktiv ? 1 : 0,
        id,
      ),
      protokollEintrag(c, {
        aktion: "platz_geaendert",
        objekt_typ: "platz",
        objekt_id: id,
        text: `${PLATZ_TYP_NAME[alt.typ]} „${name}“: ${aenderungen.join(", ")}`,
        vorher: { name: alt.name, notiz: alt.notiz, aktiv: alt.aktiv === 1 },
        nachher: { name, notiz, aktiv },
      }),
    ]);
  }
  const neu = await plaetzeLaden(c.env.DB);
  const n = await anzahlen(c.env.DB);
  return c.json(zuPlatz(neu, neu.get(id)!, n.get(id) ?? 0));
});

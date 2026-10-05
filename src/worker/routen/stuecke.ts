import { Hono } from "hono";
import { istPlatzCode, normalisiereCode } from "../../gemeinsam/codes";
import { stueckAendernSchema, stueckAnlegenSchema } from "../../gemeinsam/schemas";
import { STATUS_NAME, type Seite, type Stueck } from "../../gemeinsam/typen";
import {
  alsJson,
  platzMitUnterplaetzen,
  platzPfad,
  plaetzeLaden,
  STUECK_SELECT,
  zuStueck,
  type StueckZeile,
} from "../db/abfragen";
import { braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";
import { buchungenAbfragen } from "./buchungen";

export const stueckeRouten = new Hono<AppEnv>();

const SEITE = 50;

stueckeRouten.get("/", braucht("abfragen"), async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const status = c.req.query("status") ?? "";
  const platz = c.req.query("platz") ?? "";
  const seite = Math.max(0, Number(c.req.query("seite") ?? 0) || 0);
  const karte = await plaetzeLaden(c.env.DB);

  const bed: string[] = [];
  const werte: (string | number)[] = [];
  if (q) {
    const muster = `%${q.replace(/[\\%_]/g, (z) => "\\" + z)}%`;
    bed.push("(s.name LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\' OR s.kategorie LIKE ? ESCAPE '\\')");
    werte.push(muster, muster, muster);
  }
  if (status === "alle") {
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
  const wo = bed.length ? `WHERE ${bed.join(" AND ")}` : "";
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

stueckeRouten.get("/kategorien", braucht("abfragen"), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT kategorie, COUNT(*) AS n FROM stuecke WHERE kategorie IS NOT NULL
     GROUP BY kategorie ORDER BY n DESC LIMIT 30`,
  ).all<{ kategorie: string }>();
  return c.json(results.map((r) => r.kategorie));
});

stueckeRouten.get("/:id{[0-9]+}", braucht("abfragen"), async (c) => {
  const id = Number(c.req.param("id"));
  const karte = await plaetzeLaden(c.env.DB);
  const z = await c.env.DB.prepare(`${STUECK_SELECT} WHERE s.id = ?`).bind(id).first<StueckZeile>();
  if (!z) fehler(404, "Stück nicht gefunden");
  const verlauf = await buchungenAbfragen(c.env.DB, karte, { stueck_id: id, limit: 200 });
  return c.json({ stueck: zuStueck(karte, z), verlauf: verlauf.eintraege });
});

stueckeRouten.post("/", braucht("erfassen"), async (c) => {
  const e = await eingabe(c, stueckAnlegenSchema);
  const code = normalisiereCode(e.code);
  if (!code) fehler(400, "Code fehlt");
  if (istPlatzCode(code)) fehler(400, "Das ist ein Platz-Code, kein Stück");
  const vorhanden = await c.env.DB.prepare("SELECT name FROM stuecke WHERE code = ?")
    .bind(code)
    .first<{ name: string }>();
  if (vorhanden) fehler(409, `Code ist schon vergeben an „${vorhanden.name}“`);

  const karte = await plaetzeLaden(c.env.DB);
  const platzId = e.platz_id ?? null;
  if (platzId) {
    const p = karte.get(platzId);
    if (!p || !p.aktiv) fehler(400, "Platz nicht gefunden");
  }
  const zeit = jetzt();
  const ich = c.get("benutzer")!;
  const vorgang = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO stuecke (code, name, kategorie, beschreibung, platz_id, bewegt_am, bewegt_von_id, erstellt_am, geaendert_am)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      code,
      e.name,
      e.kategorie,
      e.beschreibung,
      platzId,
      platzId ? zeit : null,
      platzId ? ich.id : null,
      zeit,
      zeit,
    ),
  ];
  if (platzId) {
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO buchungen (vorgang_id, stueck_id, von_platz_id, nach_platz_id, art, benutzer_id, zeitpunkt)
         SELECT ?, id, NULL, ?, 'erfassen', ?, ? FROM stuecke WHERE code = ?`,
      ).bind(vorgang, platzId, ich.id, zeit, code),
    );
  }
  stmts.push(
    c.env.DB.prepare(
      `INSERT INTO protokoll (zeitpunkt, benutzer_id, aktion, objekt_typ, objekt_id, text, nachher_json, geraet)
       SELECT ?, ?, 'stueck_erfasst', 'stueck', id, ?, ?, ? FROM stuecke WHERE code = ?`,
    ).bind(
      zeit,
      ich.id,
      `Stück „${e.name}“ (${code}) erfasst${platzId ? ` → ${platzPfad(karte, platzId)}` : ""}`,
      JSON.stringify({ code, name: e.name, kategorie: e.kategorie, platz_id: platzId }),
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

  const neu = {
    name: e.name ?? alt.name,
    kategorie: e.kategorie !== undefined ? e.kategorie : alt.kategorie,
    beschreibung: e.beschreibung !== undefined ? e.beschreibung : alt.beschreibung,
    status: e.status ?? alt.status,
  };
  const aenderungen: string[] = [];
  if (neu.name !== alt.name) aenderungen.push(`Name „${alt.name}“ → „${neu.name}“`);
  if (neu.kategorie !== alt.kategorie) aenderungen.push(`Kategorie → „${neu.kategorie ?? "–"}“`);
  if (neu.beschreibung !== alt.beschreibung) aenderungen.push("Beschreibung geändert");
  if (neu.status !== alt.status) {
    aenderungen.push(`Status ${STATUS_NAME[alt.status]} → ${STATUS_NAME[neu.status]}`);
  }
  if (aenderungen.length) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE stuecke SET name = ?, kategorie = ?, beschreibung = ?, status = ?, geaendert_am = ? WHERE id = ?",
      ).bind(neu.name, neu.kategorie, neu.beschreibung, neu.status, jetzt(), id),
      protokollEintrag(c, {
        aktion: "stueck_geaendert",
        objekt_typ: "stueck",
        objekt_id: id,
        text: `Stück „${neu.name}“ (${alt.code}): ${aenderungen.join(", ")}`,
        vorher: { name: alt.name, kategorie: alt.kategorie, beschreibung: alt.beschreibung, status: alt.status },
        nachher: neu,
      }),
    ]);
  }
  const z = await c.env.DB.prepare(`${STUECK_SELECT} WHERE s.id = ?`).bind(id).first<StueckZeile>();
  return c.json(zuStueck(karte, z!));
});

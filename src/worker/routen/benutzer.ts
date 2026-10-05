import { Hono } from "hono";
import { ROLLEN_NAME, type Rolle } from "../../gemeinsam/rechte";
import { benutzerAendernSchema, benutzerAnlegenSchema } from "../../gemeinsam/schemas";
import type { Benutzer } from "../../gemeinsam/typen";
import { passwortHashen, runden } from "../auth/passwort";
import { alleSitzungenBeenden } from "../auth/sitzung";
import { benutzerVon, braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";

export const benutzerRouten = new Hono<AppEnv>();

interface BenutzerZeile {
  id: number;
  benutzername: string;
  name: string;
  rolle: Rolle;
  aktiv: number;
  passwort_aendern: number;
  erstellt_am: string;
  letzte_anmeldung: string | null;
}

const SPALTEN = "id, benutzername, name, rolle, aktiv, passwort_aendern, erstellt_am, letzte_anmeldung";

function zuBenutzer(z: BenutzerZeile): Benutzer {
  return { ...z, aktiv: z.aktiv === 1, passwort_aendern: z.passwort_aendern === 1 };
}

/** Namensliste für Filter (alle mit Recht "protokoll_alle"). */
benutzerRouten.get("/namen", braucht("protokoll_alle"), async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name FROM benutzer ORDER BY name").all();
  return c.json(results);
});

benutzerRouten.get("/", braucht("benutzer_verwalten"), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${SPALTEN} FROM benutzer ORDER BY aktiv DESC, name COLLATE NOCASE`,
  ).all<BenutzerZeile>();
  return c.json(results.map(zuBenutzer));
});

benutzerRouten.post("/", braucht("benutzer_verwalten"), async (c) => {
  const e = await eingabe(c, benutzerAnlegenSchema);
  const vorhanden = await c.env.DB.prepare("SELECT 1 FROM benutzer WHERE benutzername = ?")
    .bind(e.benutzername)
    .first();
  if (vorhanden) fehler(409, "Diesen Benutzernamen gibt es schon");
  const erg = await c.env.DB.prepare(
    `INSERT INTO benutzer (benutzername, name, rolle, passwort_hash, passwort_aendern, erstellt_am)
     VALUES (?, ?, ?, ?, 1, ?) RETURNING ${SPALTEN}`,
  )
    .bind(e.benutzername, e.name, e.rolle, await passwortHashen(e.passwort, runden(c.env)), jetzt())
    .first<BenutzerZeile>();
  const neu = zuBenutzer(erg!);
  await protokollEintrag(c, {
    aktion: "benutzer_angelegt",
    objekt_typ: "benutzer",
    objekt_id: neu.id,
    text: `Benutzer „${neu.name}“ (${ROLLEN_NAME[neu.rolle]}) angelegt`,
    nachher: { benutzername: neu.benutzername, name: neu.name, rolle: neu.rolle },
  }).run();
  return c.json(neu, 201);
});

benutzerRouten.patch("/:id{[0-9]+}", braucht("benutzer_verwalten"), async (c) => {
  const ich = benutzerVon(c);
  const id = Number(c.req.param("id"));
  const e = await eingabe(c, benutzerAendernSchema);
  const alt = await c.env.DB.prepare(`SELECT ${SPALTEN} FROM benutzer WHERE id = ?`)
    .bind(id)
    .first<BenutzerZeile>();
  if (!alt) fehler(404, "Benutzer nicht gefunden");

  const verliertAdmin =
    alt.rolle === "admin" && alt.aktiv === 1 && ((e.rolle && e.rolle !== "admin") || e.aktiv === false);
  if (verliertAdmin) {
    const z = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM benutzer WHERE rolle = 'admin' AND aktiv = 1",
    ).first<{ n: number }>();
    if ((z?.n ?? 0) <= 1) fehler(409, "Der letzte aktive Admin kann nicht entfernt werden");
  }

  const name = e.name ?? alt.name;
  const rolle = e.rolle ?? alt.rolle;
  const aktiv = e.aktiv ?? alt.aktiv === 1;
  const aenderungen: string[] = [];
  if (name !== alt.name) aenderungen.push(`Name „${alt.name}“ → „${name}“`);
  if (rolle !== alt.rolle) aenderungen.push(`Rolle ${ROLLEN_NAME[alt.rolle]} → ${ROLLEN_NAME[rolle]}`);
  if (aktiv !== (alt.aktiv === 1)) aenderungen.push(aktiv ? "aktiviert" : "deaktiviert");
  if (e.passwort) aenderungen.push("Passwort zurückgesetzt");
  if (!aenderungen.length) return c.json(zuBenutzer(alt));

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `UPDATE benutzer SET name = ?, rolle = ?, aktiv = ?,
         passwort_hash = COALESCE(?, passwort_hash),
         passwort_aendern = CASE WHEN ? IS NULL THEN passwort_aendern ELSE 1 END,
         fehlversuche = CASE WHEN ? IS NULL THEN fehlversuche ELSE 0 END,
         gesperrt_bis = CASE WHEN ? IS NULL THEN gesperrt_bis ELSE NULL END
       WHERE id = ?`,
    ).bind(
      name,
      rolle,
      aktiv ? 1 : 0,
      e.passwort ? await passwortHashen(e.passwort, runden(c.env)) : null,
      e.passwort ?? null,
      e.passwort ?? null,
      e.passwort ?? null,
      id,
    ),
    protokollEintrag(c, {
      aktion: "benutzer_geaendert",
      objekt_typ: "benutzer",
      objekt_id: id,
      text: `Benutzer „${name}“: ${aenderungen.join(", ")}`,
      vorher: { name: alt.name, rolle: alt.rolle, aktiv: alt.aktiv === 1 },
      nachher: { name, rolle, aktiv },
    }),
  ];
  // Rechte geändert, gesperrt oder neues Passwort → überall abmelden (außer eigener Namenswechsel)
  if ((rolle !== alt.rolle || !aktiv || e.passwort) && id !== ich.id) {
    stmts.push(alleSitzungenBeenden(c, id));
  }
  await c.env.DB.batch(stmts);
  const neu = await c.env.DB.prepare(`SELECT ${SPALTEN} FROM benutzer WHERE id = ?`)
    .bind(id)
    .first<BenutzerZeile>();
  return c.json(zuBenutzer(neu!));
});

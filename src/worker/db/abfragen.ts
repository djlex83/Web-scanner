// Gemeinsame Abfragen: Plätze (klein, wird komplett geladen) und Stücke.
import type { Platz, PlatzKurz, PlatzTyp, Stueck, StueckStatus } from "../../gemeinsam/typen";

export interface PlatzZeile {
  id: number;
  code: string;
  name: string;
  typ: PlatzTyp;
  eltern_id: number | null;
  notiz: string | null;
  aktiv: number;
}

export type PlatzKarte = Map<number, PlatzZeile>;

export async function plaetzeLaden(db: D1Database): Promise<PlatzKarte> {
  const { results } = await db
    .prepare("SELECT id, code, name, typ, eltern_id, notiz, aktiv FROM plaetze")
    .all<PlatzZeile>();
  return new Map(results.map((p) => [p.id, p]));
}

export function platzPfad(karte: PlatzKarte, id: number): string {
  const teile: string[] = [];
  let p = karte.get(id);
  for (let i = 0; p && i < 10; i++) {
    teile.unshift(p.name);
    p = p.eltern_id ? karte.get(p.eltern_id) : undefined;
  }
  return teile.join(" › ");
}

export function platzKurz(karte: PlatzKarte, id: number | null): PlatzKurz | null {
  if (id == null) return null;
  const p = karte.get(id);
  if (!p) return null;
  return { id: p.id, name: p.name, typ: p.typ, pfad: platzPfad(karte, id) };
}

export function zuPlatz(karte: PlatzKarte, p: PlatzZeile, anzahl: number): Platz {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    typ: p.typ,
    pfad: platzPfad(karte, p.id),
    eltern_id: p.eltern_id,
    notiz: p.notiz,
    aktiv: p.aktiv === 1,
    anzahl,
  };
}

/** IDs des Platzes und aller darunterliegenden Plätze. */
export function platzMitUnterplaetzen(karte: PlatzKarte, id: number): number[] {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) {
    for (const p of karte.values()) if (p.eltern_id === ids[i]) ids.push(p.id);
  }
  return ids;
}

export interface StueckZeile {
  id: number;
  code: string;
  name: string;
  beschreibung: string | null;
  kategorie: string | null;
  status: StueckStatus;
  platz_id: number | null;
  bewegt_am: string | null;
  bewegt_von: string | null;
  erstellt_am: string;
  foto_version: number | null;
  inventur: number;
  vermisst_seit: string | null;
  behaelter: number;
  in_behaelter_id: number | null;
  behaelter_code: string | null;
  behaelter_name: string | null;
  inhalt: number;
  ausleihe_id: number | null;
  ausleihe_an: string | null;
  ausleihe_bis: string | null;
  ausleihe_seit: string | null;
  pruef_art: string | null;
  pruef_intervall: number | null;
  pruef_naechste: string | null;
}

/** Stück mit Behälter, offener Ausleihe und Inhaltsanzahl; Bedingungen mit Alias "s" anhängen. */
export const STUECK_SELECT = `SELECT s.id, s.code, s.name, s.beschreibung, s.kategorie, s.status, s.platz_id,
  s.bewegt_am, b.name AS bewegt_von, s.erstellt_am, s.foto_version,
  s.inventur, s.vermisst_seit, s.behaelter, s.in_behaelter_id, k.code AS behaelter_code, k.name AS behaelter_name,
  CASE WHEN s.behaelter = 1 THEN
    (SELECT COUNT(*) FROM stuecke i WHERE i.in_behaelter_id = s.id AND i.status != 'ausgemustert') ELSE 0 END AS inhalt,
  a.id AS ausleihe_id, a.an AS ausleihe_an, a.bis AS ausleihe_bis, a.ausgegeben_am AS ausleihe_seit,
  s.pruef_art, s.pruef_intervall, s.pruef_naechste
  FROM stuecke s
  LEFT JOIN benutzer b ON b.id = s.bewegt_von_id
  LEFT JOIN stuecke k ON k.id = s.in_behaelter_id
  LEFT JOIN ausleihen a ON a.stueck_id = s.id AND a.zurueck_am IS NULL`;

export function zuStueck(karte: PlatzKarte, z: StueckZeile): Stueck {
  return {
    id: z.id,
    code: z.code,
    name: z.name,
    beschreibung: z.beschreibung,
    kategorie: z.kategorie,
    status: z.status,
    platz: platzKurz(karte, z.platz_id),
    bewegt_am: z.bewegt_am,
    bewegt_von: z.bewegt_von,
    erstellt_am: z.erstellt_am,
    foto_version: z.foto_version,
    inventur: z.inventur === 1,
    vermisst_seit: z.vermisst_seit,
    behaelter: z.behaelter === 1,
    inhalt: z.inhalt,
    in_behaelter: z.in_behaelter_id ? { id: z.in_behaelter_id, code: z.behaelter_code!, name: z.behaelter_name! } : null,
    ausleihe: z.ausleihe_id
      ? { id: z.ausleihe_id, an: z.ausleihe_an!, bis: z.ausleihe_bis, seit: z.ausleihe_seit! }
      : null,
    pruefung: { art: z.pruef_art, intervall: z.pruef_intervall, naechste: z.pruef_naechste },
  };
}

/** Bindet eine Liste als einen einzigen Parameter: `IN (SELECT value FROM json_each(?))`. */
export const alsJson = (werte: readonly (string | number)[]) => JSON.stringify(werte);

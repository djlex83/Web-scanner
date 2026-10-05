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
}

export const STUECK_SELECT = `SELECT s.id, s.code, s.name, s.beschreibung, s.kategorie, s.status, s.platz_id,
  s.bewegt_am, b.name AS bewegt_von, s.erstellt_am
  FROM stuecke s LEFT JOIN benutzer b ON b.id = s.bewegt_von_id`;

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
  };
}

/** Bindet eine Liste als einen einzigen Parameter: `IN (SELECT value FROM json_each(?))`. */
export const alsJson = (werte: readonly (string | number)[]) => JSON.stringify(werte);

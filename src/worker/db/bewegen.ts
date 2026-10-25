// Stücke bewegen: Platz/Behälter ändern, Buchungen schreiben, Behälter-Inhalt mitnehmen.
// Alle Anweisungen arbeiten mit einer JSON-Liste – ihre Anzahl hängt nicht von der Zahl der Stücke ab
// (D1 im kostenlosen Tarif: höchstens 50 Abfragen je Aufruf).
import { alsJson, platzPfad, type PlatzKarte, type PlatzZeile } from "./abfragen";
import { fehler } from "../kontext";

/** s = Stück, p = neuer Platz, b = neuer Behälter (oder null) */
export interface Bewegung {
  s: number;
  p: number | null;
  b: number | null;
}

export interface BewegungsKontext {
  vorgang: string;
  benutzer_id: number;
  zeit: string;
  notiz: string | null;
  /** Stammplatz beim ersten Einlagern setzen (Standard) oder nie anfassen (Rückgängig, Zurückräumen) */
  stamm?: "wenn_leer" | "nie";
}

/** Wert aus der JSON-Liste für das Stück mit der ID in `spalte`. */
const ausListe = (feld: "p" | "b", spalte: string) =>
  `(SELECT json_extract(value, '$.${feld}') FROM json_each(?) WHERE json_extract(value, '$.s') = ${spalte})`;
const idsAusListe = "(SELECT json_extract(value, '$.s') FROM json_each(?))";

/** Anweisungen in dieser Reihenfolge in einen Batch legen (eine Transaktion). */
export function bewegen(db: D1Database, k: BewegungsKontext, liste: Bewegung[]): D1PreparedStatement[] {
  if (!liste.length) return [];
  const j = JSON.stringify(liste);
  return [
    // 1. Buchungen mit dem bisherigen Ort schreiben
    db
      .prepare(
        `INSERT INTO buchungen (vorgang_id, stueck_id, von_platz_id, nach_platz_id, von_behaelter_id, nach_behaelter_id,
                                art, benutzer_id, zeitpunkt, notiz)
         SELECT ?, s.id, s.platz_id, json_extract(j.value, '$.p'), s.in_behaelter_id, json_extract(j.value, '$.b'),
                'umbuchen', ?, ?, ?
         FROM json_each(?) j JOIN stuecke s ON s.id = json_extract(j.value, '$.s')`,
      )
      .bind(k.vorgang, k.benutzer_id, k.zeit, k.notiz, j),
    // 2. Inhalt bewegter Behälter wandert mit
    db
      .prepare(
        `INSERT INTO buchungen (vorgang_id, stueck_id, von_platz_id, nach_platz_id, von_behaelter_id, nach_behaelter_id,
                                art, benutzer_id, zeitpunkt, mitgefuehrt)
         SELECT ?, i.id, i.platz_id, json_extract(j.value, '$.p'), i.in_behaelter_id, i.in_behaelter_id,
                'umbuchen', ?, ?, 1
         FROM json_each(?) j JOIN stuecke i ON i.in_behaelter_id = json_extract(j.value, '$.s')
         WHERE i.status != 'ausgemustert' AND i.platz_id IS NOT json_extract(j.value, '$.p')`,
      )
      .bind(k.vorgang, k.benutzer_id, k.zeit, j),
    db
      .prepare(
        `UPDATE stuecke SET platz_id = ${ausListe("p", "stuecke.in_behaelter_id")}, bewegt_am = ?, bewegt_von_id = ?, geaendert_am = ?
         WHERE in_behaelter_id IN ${idsAusListe} AND status != 'ausgemustert'`,
      )
      .bind(j, k.zeit, k.benutzer_id, k.zeit, j),
    // 3. Die Stücke selbst; wer bewegt wird, ist nicht mehr vermisst.
    //    Ohne Stammplatz wird der erste Ort zum Stammplatz (Behälter oder Platz).
    k.stamm === "nie"
      ? db
          .prepare(
            `UPDATE stuecke SET platz_id = ${ausListe("p", "stuecke.id")}, in_behaelter_id = ${ausListe("b", "stuecke.id")},
                    bewegt_am = ?, bewegt_von_id = ?, geaendert_am = ?, vermisst_seit = NULL
             WHERE id IN ${idsAusListe}`,
          )
          .bind(j, j, k.zeit, k.benutzer_id, k.zeit, j)
      : db
          .prepare(
            `UPDATE stuecke SET platz_id = ${ausListe("p", "stuecke.id")}, in_behaelter_id = ${ausListe("b", "stuecke.id")},
                    stamm_platz_id = CASE WHEN stamm_platz_id IS NULL AND stamm_behaelter_id IS NULL
                      THEN CASE WHEN ${ausListe("b", "stuecke.id")} IS NULL THEN ${ausListe("p", "stuecke.id")} END
                      ELSE stamm_platz_id END,
                    stamm_behaelter_id = CASE WHEN stamm_platz_id IS NULL AND stamm_behaelter_id IS NULL
                      THEN ${ausListe("b", "stuecke.id")} ELSE stamm_behaelter_id END,
                    bewegt_am = ?, bewegt_von_id = ?, geaendert_am = ?, vermisst_seit = NULL
             WHERE id IN ${idsAusListe}`,
          )
          .bind(j, j, j, j, j, k.zeit, k.benutzer_id, k.zeit, j),
    // 4. Verliehene Stücke gelten mit dem Einbuchen als zurückgegeben
    db
      .prepare(`UPDATE ausleihen SET zurueck_am = ?, zurueck_von_id = ? WHERE zurueck_am IS NULL AND stueck_id IN ${idsAusListe}`)
      .bind(k.zeit, k.benutzer_id, j),
  ];
}

export interface StueckOrt {
  id: number;
  code: string;
  name: string;
  status: string;
  platz_id: number | null;
  in_behaelter_id: number | null;
  behaelter: number;
  vermisst_seit: string | null;
  verliehen: number;
  stamm_platz_id: number | null;
  stamm_behaelter_id: number | null;
}

export async function stueckeLaden(db: D1Database, ids: number[]): Promise<StueckOrt[]> {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.code, s.name, s.status, s.platz_id, s.in_behaelter_id, s.behaelter, s.vermisst_seit,
              s.stamm_platz_id, s.stamm_behaelter_id,
              EXISTS (SELECT 1 FROM ausleihen a WHERE a.stueck_id = s.id AND a.zurueck_am IS NULL) AS verliehen
       FROM stuecke s WHERE s.id IN (SELECT value FROM json_each(?))`,
    )
    .bind(alsJson(ids))
    .all<StueckOrt>();
  return results;
}

export type Ziel =
  | { art: "platz"; platz: PlatzZeile }
  | { art: "behaelter"; behaelter: StueckOrt };

export async function zielLaden(
  db: D1Database,
  karte: PlatzKarte,
  e: { nach_platz_id?: number | null; nach_behaelter_id?: number | null },
): Promise<Ziel> {
  if (e.nach_platz_id) {
    const p = karte.get(e.nach_platz_id);
    if (!p || !p.aktiv) fehler(400, "Zielplatz nicht gefunden");
    return { art: "platz", platz: p };
  }
  const [b] = await stueckeLaden(db, [e.nach_behaelter_id!]);
  if (!b || b.behaelter !== 1) fehler(400, "Ziel-Behälter nicht gefunden");
  if (b.status === "ausgemustert") fehler(400, `„${b.name}“ ist ausgemustert`);
  return { art: "behaelter", behaelter: b };
}

export function zielText(karte: PlatzKarte, z: Ziel): string {
  if (z.art === "platz") return platzPfad(karte, z.platz.id);
  const b = z.behaelter;
  return `Behälter „${b.name}“${b.platz_id ? ` (${platzPfad(karte, b.platz_id)})` : ""}`;
}

/** Prüft die Stücke und liefert die nötigen Bewegungen (Stücke, die schon dort sind, fallen weg). */
export function bewegungenZu(z: Ziel, stuecke: StueckOrt[]): { bewegungen: Bewegung[]; schonDort: number } {
  const ausgemustert = stuecke.find((s) => s.status === "ausgemustert");
  if (ausgemustert) fehler(400, `„${ausgemustert.name}“ ist ausgemustert und kann nicht gebucht werden`);
  if (z.art === "behaelter") {
    if (stuecke.some((s) => s.id === z.behaelter.id)) fehler(400, "Ein Behälter kann nicht in sich selbst liegen");
    const kiste = stuecke.find((s) => s.behaelter === 1);
    if (kiste) fehler(400, `„${kiste.name}“ ist selbst ein Behälter und kann nicht in einen Behälter`);
  }
  const bewegungen: Bewegung[] = [];
  for (const s of stuecke) {
    const p = z.art === "platz" ? z.platz.id : z.behaelter.platz_id;
    const b = z.art === "platz" ? null : z.behaelter.id;
    if (s.platz_id === p && s.in_behaelter_id === b) continue;
    bewegungen.push({ s: s.id, p, b });
  }
  return { bewegungen, schonDort: stuecke.length - bewegungen.length };
}

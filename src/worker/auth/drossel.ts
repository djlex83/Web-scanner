import { fehler, jetzt, type Ctx } from "../kontext";

export function clientIp(c: Ctx): string {
  return c.req.header("cf-connecting-ip") ?? "lokal";
}

/**
 * Zählt Versuche je Schlüssel in einem Zeitfenster und bricht mit 429 ab, wenn es zu viele sind.
 * Schlüssel z. B. "ip:1.2.3.4" (Anmeldung) oder "notfall:alle" (Notfall-Code, gesamt).
 */
export async function drosseln(c: Ctx, schluessel: string, max: number, fensterMin: number, meldung: string): Promise<void> {
  const grenze = new Date(Date.now() - fensterMin * 60_000).toISOString();
  const z = await c.env.DB.prepare(
    `INSERT INTO anmelde_drossel (schluessel, anzahl, fenster_start) VALUES (?, 1, ?)
     ON CONFLICT(schluessel) DO UPDATE SET
       anzahl = CASE WHEN fenster_start < ? THEN 1 ELSE anzahl + 1 END,
       fenster_start = CASE WHEN fenster_start < ? THEN excluded.fenster_start ELSE fenster_start END
     RETURNING anzahl`,
  )
    .bind(schluessel, jetzt(), grenze, grenze)
    .first<{ anzahl: number }>();
  if ((z?.anzahl ?? 0) > max) fehler(429, meldung);
}

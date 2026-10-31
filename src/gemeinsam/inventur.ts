// Welche Plätze sind schon gezählt? Reine Logik – genutzt von der Regal-Auswahl, getestet in tests/inventur.test.ts.

import type { InventurEintrag } from "./typen";

/** So lange gilt ein Regal nach der Inventur als „gezählt“ (danach wieder neutral). */
export const GEZAEHLT_TAGE = 30;

export type GezaehltStand = "vollstaendig" | "luecken";

export interface Gezaehlt {
  eintrag: InventurEintrag;
  stand: GezaehltStand;
  /** gezählt über einen übergeordneten Platz (z. B. die ganze Abteilung) */
  ueber: string | null;
}

/**
 * Je Platz die jüngste Inventur der letzten `tage` Tage – die eigene oder die eines übergeordneten Platzes,
 * denn eine Inventur zählt alles darunter mit. „vollständig“ = nichts fehlt und nichts zusätzlich.
 */
export function gezaehltePlaetze(
  plaetze: { id: number; eltern_id: number | null }[],
  eintraege: InventurEintrag[],
  jetzt: Date = new Date(),
  tage = GEZAEHLT_TAGE,
): Map<number, Gezaehlt> {
  const grenze = jetzt.getTime() - tage * 24 * 60 * 60 * 1000;
  const juengste = new Map<number, InventurEintrag>();
  for (const e of eintraege) {
    if (!e.platz) continue;
    const zeit = Date.parse(e.zeitpunkt);
    if (!Number.isFinite(zeit) || zeit < grenze) continue;
    const bisher = juengste.get(e.platz.id);
    if (!bisher || Date.parse(bisher.zeitpunkt) < zeit) juengste.set(e.platz.id, e);
  }

  const eltern = new Map(plaetze.map((p) => [p.id, p.eltern_id]));
  const ergebnis = new Map<number, Gezaehlt>();
  for (const p of plaetze) {
    let beste: InventurEintrag | undefined;
    let id: number | null = p.id;
    const gesehen = new Set<number>();
    while (id !== null && !gesehen.has(id)) {
      gesehen.add(id);
      const e = juengste.get(id);
      if (e && (!beste || Date.parse(beste.zeitpunkt) < Date.parse(e.zeitpunkt))) beste = e;
      id = eltern.get(id) ?? null;
    }
    if (!beste) continue;
    ergebnis.set(p.id, {
      eintrag: beste,
      stand: beste.fehlend === 0 && beste.zusaetzlich === 0 ? "vollstaendig" : "luecken",
      ueber: beste.platz && beste.platz.id !== p.id ? beste.platz.name : null,
    });
  }
  return ergebnis;
}

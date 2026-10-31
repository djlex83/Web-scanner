import { describe, expect, it } from "vitest";
import { gezaehltePlaetze } from "../src/gemeinsam/inventur";
import type { InventurEintrag } from "../src/gemeinsam/typen";

const jetzt = new Date("2026-10-31T12:00:00Z");
const vorTagen = (t: number) => new Date(jetzt.getTime() - t * 24 * 60 * 60 * 1000).toISOString();

const eintrag = (platzId: number, name: string, tage: number, fehlend = 0, zusaetzlich = 0): InventurEintrag => ({
  id: platzId * 100 + tage,
  platz: { id: platzId, name, typ: "regal", pfad: name },
  benutzer: "Test",
  zeitpunkt: vorTagen(tage),
  erwartet: 3,
  gefunden: 3 - fehlend,
  fehlend,
  zusaetzlich,
  verliehen: 0,
});

// Lager (1) › Regal A (2) › Fach A1 (3); Regal B (4); Regal C (5)
const plaetze = [
  { id: 1, eltern_id: null },
  { id: 2, eltern_id: 1 },
  { id: 3, eltern_id: 2 },
  { id: 4, eltern_id: 1 },
  { id: 5, eltern_id: 1 },
];

describe("Inventur: welche Plätze sind gezählt", () => {
  it("vollständig, mit Lücken und ungezählt", () => {
    const g = gezaehltePlaetze(plaetze, [eintrag(2, "Regal A", 1), eintrag(4, "Regal B", 2, 1)], jetzt);
    expect(g.get(2)?.stand).toBe("vollstaendig");
    expect(g.get(4)?.stand).toBe("luecken");
    expect(g.has(5)).toBe(false);
    expect(g.has(1)).toBe(false);
  });

  it("Fächer gelten über ihr Regal als gezählt", () => {
    const g = gezaehltePlaetze(plaetze, [eintrag(2, "Regal A", 1)], jetzt);
    expect(g.get(3)).toMatchObject({ stand: "vollstaendig", ueber: "Regal A" });
    expect(g.get(2)?.ueber).toBeNull();
  });

  it("nach 30 Tagen wieder neutral; die jüngste Inventur zählt", () => {
    expect(gezaehltePlaetze(plaetze, [eintrag(2, "Regal A", 31)], jetzt).has(2)).toBe(false);
    const g = gezaehltePlaetze(plaetze, [eintrag(2, "Regal A", 5, 2), eintrag(2, "Regal A", 1)], jetzt);
    expect(g.get(2)?.stand).toBe("vollstaendig");
    // eigene Inventur jünger als die der Abteilung
    const h = gezaehltePlaetze(plaetze, [eintrag(1, "Lager", 10), eintrag(4, "Regal B", 2, 0, 1)], jetzt);
    expect(h.get(4)).toMatchObject({ stand: "luecken", ueber: null });
    expect(h.get(5)).toMatchObject({ stand: "vollstaendig", ueber: "Lager" });
  });
});

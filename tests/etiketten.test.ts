import { describe, expect, it } from "vitest";
import { EIGEN_ID, VORLAGEN, eigeneVorlage, gestaltung, position, vorlageFinden } from "../src/app/lib/etiketten";

describe("Etiketten-Vorlagen", () => {
  it("alle Etiketten liegen vollständig auf dem Papier", () => {
    for (const v of VORLAGEN) {
      const letztes = position(v, v.spalten * v.zeilen - 1);
      expect(letztes.links + v.etikett.breite, v.id).toBeLessThanOrEqual(v.papier.breite + 0.01);
      expect(letztes.oben + v.etikett.hoehe, v.id).toBeLessThanOrEqual(v.papier.hoehe + 0.01);
      expect(position(v, 0).links, v.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("A4-Bogen mit 21 Etiketten hat die Maße von L7160", () => {
    const v = vorlageFinden("a4-21", { breite: 62, hoehe: 29 });
    expect(position(v, 0)).toEqual({ links: 7.2, oben: 15.15 });
    expect(position(v, 4)).toEqual({ links: 7.2 + 66, oben: 15.15 + 38.1 });
  });

  it("alte Einstellungen und unbekannte Werte führen zu einer gültigen Vorlage", () => {
    expect(vorlageFinden("gross", { breite: 62, hoehe: 29 }).id).toBe("a4-8");
    expect(vorlageFinden("klein", { breite: 62, hoehe: 29 }).id).toBe("a4-21");
    expect(vorlageFinden("gibt-es-nicht", { breite: 62, hoehe: 29 }).id).toBe("a4-21");
  });

  it("Etikettendrucker: ein Etikett je Seite, Größe begrenzt", () => {
    const v = vorlageFinden(EIGEN_ID, { breite: 62, hoehe: 29 });
    expect(v.papier).toMatchObject({ breite: 62, hoehe: 29 });
    expect(v.spalten * v.zeilen).toBe(1);
    expect(eigeneVorlage(5, 1000).papier).toMatchObject({ breite: 20, hoehe: 300 });
    expect(eigeneVorlage(NaN, 40).papier.breite).toBe(20);
  });

  it("QR-Code und Text passen in jedes Etikett", () => {
    const vorlagen = [...VORLAGEN, eigeneVorlage(62, 29), eigeneVorlage(40, 60)];
    for (const v of vorlagen) {
      const g = gestaltung(v, "Hochregallager Nord");
      expect(g.qr, v.id).toBeGreaterThan(10);
      expect(g.qr + 2 * g.rand, v.id).toBeLessThanOrEqual(Math.min(v.etikett.breite, v.etikett.hoehe) + 0.01);
      expect(g.name, v.id).toBeGreaterThanOrEqual(6);
    }
    // hohe Etiketten: QR oben, Text darunter
    expect(gestaltung(vorlageFinden("a4-schild-a6", { breite: 0, hoehe: 0 }), "Regal 1").hochkant).toBe(true);
    expect(gestaltung(vorlageFinden("a4-21", { breite: 0, hoehe: 0 }), "Regal 1").hochkant).toBe(false);
  });

  it("lange Wörter bekommen eine kleinere Schrift", () => {
    const v = vorlageFinden("a4-21", { breite: 0, hoehe: 0 });
    expect(gestaltung(v, "Kleinteilemagazinschublade").name).toBeLessThan(gestaltung(v, "Regal 1").name);
  });
});

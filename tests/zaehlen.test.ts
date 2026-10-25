import { describe, expect, it } from "vitest";
import {
  ausgabeLesen,
  auswerten,
  codesZuordnen,
  doppelteEntfernen,
  iou,
  rahmenBerechnen,
  zuGrossEntfernen,
  type Kasten,
} from "../src/app/zaehlen/auswertung";

const k = (x1: number, y1: number, x2: number, y2: number, wert = 0.9): Kasten => ({ x1, y1, x2, y2, wert });
const etikett = (code: string, x: number, y: number, s = 10) => ({
  code,
  ecken: [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
  ],
});

describe("Zählhilfe: Modellausgabe", () => {
  it("rechnet Letterbox-Koordinaten aufs Foto zurück", () => {
    // Querformat 1280×640 → Faktor 0,5, oben und unten je 160 px Rand
    const r = rahmenBerechnen(1280, 640, 640);
    expect(r).toMatchObject({ faktor: 0.5, versatzX: 0, versatzY: 160 });
    const kaesten = ausgabeLesen([100, 200, 300, 400, 0.8, 7, 0, 0], 8, r, 0.25);
    expect(kaesten).toEqual([{ x1: 200, y1: 80, x2: 600, y2: 480, wert: 0.8 }]);
  });

  it("verwirft unsichere, winzige und leere Zeilen und klemmt auf den Bildrand", () => {
    const r = rahmenBerechnen(640, 640, 640);
    const daten = [
      [10, 10, 100, 100, 0.2, 0], // zu unsicher
      [10, 10, 11, 11, 0.9, 0], // winzig
      [0, 0, 0, 0, 0, 0], // Füllzeile des Modells
      [-20, -20, 700, 50, 0.9, 1], // über den Rand
    ].flat();
    expect(ausgabeLesen(daten, 6, r, 0.3)).toEqual([{ x1: 0, y1: 0, x2: 640, y2: 50, wert: 0.9 }]);
    expect(() => ausgabeLesen([1, 2, 3], 3, r, 0.3)).toThrow();
  });
});

describe("Zählhilfe: Bereinigung", () => {
  it("zählt denselben Gegenstand unter zwei Namen nur einmal", () => {
    const raus = doppelteEntfernen([k(0, 0, 100, 100, 0.9), k(5, 5, 102, 98, 0.6), k(200, 0, 300, 100, 0.7)]);
    expect(raus).toHaveLength(2);
    expect(raus[0]!.wert).toBe(0.9);
  });

  it("entfernt Teile eines Gegenstands, behält aber Kleines in großen Kisten", () => {
    // Griff (fast ganz im Werkzeug, ähnlich groß) → weg
    expect(doppelteEntfernen([k(0, 0, 100, 100, 0.9), k(10, 10, 90, 90, 0.5)])).toHaveLength(1);
    // Kleines Teil in einem viel größeren Kasten → bleibt
    expect(doppelteEntfernen([k(0, 0, 400, 400, 0.9), k(10, 10, 60, 60, 0.5)])).toHaveLength(2);
  });

  it("wirft das ganze Regal raus", () => {
    expect(zuGrossEntfernen([k(0, 0, 1000, 800), k(10, 10, 100, 100)], 1000, 1000)).toHaveLength(1);
  });

  it("iou ist symmetrisch und 0 ohne Überschneidung", () => {
    expect(iou(k(0, 0, 10, 10), k(5, 0, 15, 10))).toBeCloseTo(1 / 3);
    expect(iou(k(0, 0, 10, 10), k(20, 20, 30, 30))).toBe(0);
  });
});

describe("Zählhilfe: Codes zuordnen", () => {
  it("ordnet jeden Code dem kleinsten Gegenstand zu und erkennt Gegenstände ohne Etikett", () => {
    const kiste = k(0, 0, 500, 500);
    const flex = k(20, 20, 120, 120);
    const akku = k(300, 300, 400, 400);
    const { gegenstaende, ohneGegenstand } = codesZuordnen(
      [kiste, flex, akku],
      [etikett("A-1", 50, 50), etikett("K-1", 200, 200), etikett("X-9", 900, 900)],
    );
    expect(gegenstaende.map((g) => g.code)).toEqual(["K-1", "A-1", null]);
    expect(ohneGegenstand).toEqual(["X-9"]);
  });

  it("ein Kasten, der nur das Etikett ist, zählt nicht als Gegenstand", () => {
    const { gegenstaende } = codesZuordnen([k(50, 50, 60, 60), k(0, 0, 100, 100)], [etikett("A-1", 50, 50)]);
    expect(gegenstaende).toHaveLength(1);
    expect(gegenstaende[0]!.code).toBe("A-1");
  });

  it("Gesamtergebnis: Schätzung = Gegenstände + Codes ohne erkannten Gegenstand", () => {
    const e = auswerten(
      [k(0, 0, 100, 100), k(200, 0, 300, 100), k(0, 0, 1000, 1000)],
      [etikett("A-1", 40, 40), etikett("B-2", 600, 600), etikett("B-2", 600, 600)],
      1000,
      1000,
    );
    expect(e).toMatchObject({ mitCode: 1, ohneCode: 1, geschaetzt: 3, codes: ["A-1", "B-2"] });
  });
});

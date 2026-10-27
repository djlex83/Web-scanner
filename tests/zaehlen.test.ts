import { describe, expect, it } from "vitest";
import {
  codesZuPunkten,
  doppeltePunkteEntfernen,
  geminiAnweisung,
  geminiPunkte,
  MAX_ZIELE,
  moondreamPunkte,
  zieleVorschlagen,
} from "../src/gemeinsam/zaehlen";
import { adminEinrichten, Client } from "./hilfen";

const stueck = (name: string, kategorie: string | null = null, beschreibung: string | null = null) => ({ name, kategorie, beschreibung });

describe("Zählhilfe: Arten aus den Stücken", () => {
  it("gruppiert nach Kategorie, nimmt Name und Beschreibung dazu, größte Gruppe zuerst", () => {
    const ziele = zieleVorschlagen([
      stueck("Akkuschrauber GSR 18V", "Elektrowerkzeug", "blauer Koffer"),
      stueck("Akkuschrauber GSR 18V", "elektrowerkzeug"),
      stueck("Wasserwaage 60 cm", null, "gelb, Aluminium"),
    ]);
    expect(ziele).toEqual([
      { text: "Elektrowerkzeug: Akkuschrauber GSR 18V, blauer Koffer", soll: 2 },
      { text: "Wasserwaage 60 cm: gelb, Aluminium", soll: 1 },
    ]);
  });

  it("nennt bei verschiedenen Stücken einer Kategorie deren Namen", () => {
    const [z] = zieleVorschlagen([stueck("Flex", "Werkzeug"), stueck("Bohrmaschine", "Werkzeug"), stueck("Stichsäge", "Werkzeug")]);
    expect(z).toEqual({ text: "Werkzeug: Flex, Bohrmaschine, Stichsäge", soll: 3 });
  });

  it("kürzt lange Beschreibungen und begrenzt die Zahl der Arten", () => {
    const lang = "sehr ".repeat(60) + "langer Text";
    const [z] = zieleVorschlagen([stueck("Koffer", null, lang)]);
    expect(z!.text.length).toBeLessThanOrEqual(120);
    expect(z!.text.endsWith("…")).toBe(true);
    const viele = Array.from({ length: 10 }, (_, i) => stueck(`Teil ${i}`));
    expect(zieleVorschlagen(viele)).toHaveLength(MAX_ZIELE);
    expect(zieleVorschlagen([])).toEqual([]);
  });
});

describe("Zählhilfe: Antworten der Modelle", () => {
  it("Moondream: normierte Punkte bleiben, Pixel werden umgerechnet, Ausreißer fallen weg", () => {
    expect(moondreamPunkte([{ x: 0.25, y: 0.5 }, { x: 1.2, y: 0.5 }], 2, 1000, 800)).toEqual([{ x: 0.25, y: 0.5, ziel: 2 }]);
    expect(moondreamPunkte([{ x: 500, y: 400 }], 0, 1000, 800)).toEqual([{ x: 0.5, y: 0.5, ziel: 0 }]);
    expect(moondreamPunkte(null, 0, 10, 10)).toEqual([]);
  });

  it("Gemini: liest y/x auf 0–1000, auch als point-Array, auch in Code-Zaun", () => {
    const text = '```json\n{"punkte":[{"ziel":1,"y":250,"x":500},{"ziel":7,"point":[100,900]},{"ziel":0,"y":1200,"x":10}]}\n```';
    expect(geminiPunkte(text, 2)).toEqual([
      { x: 0.5, y: 0.25, ziel: 1 },
      { x: 0.9, y: 0.1, ziel: null },
    ]);
    expect(geminiPunkte('[{"ziel":0,"y":0,"x":0}]', 1)).toEqual([{ x: 0, y: 0, ziel: 0 }]);
    expect(() => geminiPunkte("kein json", 1)).toThrow();
    expect(() => geminiPunkte('{"anders":1}', 1)).toThrow();
  });

  it("Gemini-Anweisung nummeriert die Arten", () => {
    const a = geminiAnweisung(["Akkuschrauber", "Koffer"]);
    expect(a).toContain("0: Akkuschrauber");
    expect(a).toContain("1: Koffer");
  });
});

describe("Zählhilfe: Punkte und Codes", () => {
  it("führt dasselbe Teil unter zwei Arten zusammen, lässt Nachbarn stehen", () => {
    const punkte = [
      { x: 0.5, y: 0.5, ziel: 0 },
      { x: 0.505, y: 0.5, ziel: 1 },
      { x: 0.6, y: 0.5, ziel: 1 },
    ];
    expect(doppeltePunkteEntfernen(punkte, 1000, 1000)).toEqual([punkte[0], punkte[2]]);
  });

  it("ordnet jeden Code dem nächsten Punkt zu, jeden höchstens einmal", () => {
    const punkte = [
      { x: 0.2, y: 0.2, ziel: 0 },
      { x: 0.25, y: 0.2, ziel: 0 },
      { x: 0.9, y: 0.9, ziel: 0 },
    ];
    const z = codesZuPunkten(
      punkte,
      [
        { code: "A-1", x: 0.21, y: 0.21 },
        { code: "A-2", x: 0.22, y: 0.21 },
        { code: "X-9", x: 0.5, y: 0.6 },
      ],
      1000,
      1000,
    );
    expect([...z.entries()].sort()).toEqual([
      [0, "A-1"],
      [1, "A-2"],
    ]);
  });
});

describe("Zählhilfe: Schnittstelle", () => {
  const bild = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

  it("verlangt Anmeldung", async () => {
    const r = await new Client().post("/zaehlen", { modell: "moondream", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] });
    expect(r.status).toBe(401);
  });

  it("prüft Foto und Arten", async () => {
    const admin = await adminEinrichten();
    expect((await admin.post("/zaehlen", { modell: "moondream", bild: "http://x", breite: 640, hoehe: 480, ziele: ["Koffer"] })).status).toBe(400);
    expect((await admin.post("/zaehlen", { modell: "moondream", bild, breite: 640, hoehe: 480, ziele: [] })).status).toBe(400);
    expect((await admin.post("/zaehlen", { modell: "anders", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] })).status).toBe(400);
  });

  it("Gemini ohne Schlüssel ist nicht eingerichtet", async () => {
    const admin = await adminEinrichten();
    expect((await admin.get("/zaehlen/modelle")).daten.gemini).toBe(false);
    const r = await admin.post("/zaehlen", { modell: "gemini", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] });
    expect(r.status).toBe(409);
  });
});

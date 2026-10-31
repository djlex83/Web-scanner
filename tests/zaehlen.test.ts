import { describe, expect, it } from "vitest";
import {
  antwortKurz,
  codesZuPunkten,
  doppeltePunkteEntfernen,
  geminiAnweisung,
  geminiPunkte,
  MAX_ZIELE,
  moondreamAntwortFehler,
  moondreamAntwortPunkte,
  moondreamFrage,
  moondreamKandidaten,
  moondreamPunkte,
  moondreamRohpunkte,
  moondreamStromLesen,
  textPunkte,
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

describe("Zählhilfe: Moondream robust lesen", () => {
  it("findet Punkte direkt, verschachtelt und als Paare", () => {
    expect(moondreamRohpunkte({ points: [{ x: 0.1, y: 0.2 }] })).toEqual([{ x: 0.1, y: 0.2 }]);
    expect(moondreamRohpunkte({ result: { points: [[0.3, 0.4]] } })).toEqual([{ x: 0.3, y: 0.4 }]);
    expect(moondreamRohpunkte({ output: { points: [{ x: "0.5", y: 0.6 }] } })).toEqual([{ x: 0.5, y: 0.6 }]);
    expect(moondreamRohpunkte({ points: null, finish_reason: "stop" })).toEqual([]);
    expect(moondreamRohpunkte(null)).toEqual([]);
  });

  it("versucht erst den vollen Text, dann den Begriff vor dem Doppelpunkt, zuletzt das deutsche Wort", () => {
    expect(moondreamKandidaten("Power tools: cordless drill, blue case", "Elektrowerkzeug: Akkuschrauber, blauer Koffer")).toEqual([
      "Power tools: cordless drill, blue case",
      "Power tools",
      "Elektrowerkzeug",
    ]);
    expect(moondreamKandidaten("Shares", "Schere")).toEqual(["Shares", "Schere"]);
    expect(moondreamKandidaten("  suitcase ")).toEqual(["suitcase"]);
    // Übersetzung fehlgeschlagen = Original: kein doppelter Versuch
    expect(moondreamKandidaten("Koffer", "Koffer")).toEqual(["Koffer"]);
  });

  it("liest das Ergebnis aus dem Datenstrom (echte Antwort von Cloudflare, gekürzt)", () => {
    const strom = [
      'data: {"id":"a","status":"processing","usage":{"neurons":0}}',
      "",
      'data: {"mode":"replace","name":"task","value":"query"}',
      "",
      'data: {"chunk":{"answer":"The","finish_reason":"","points":null},"index":0}',
      "",
      'data: {"chunk":{"answer":"The capital of France is Paris.","finish_reason":"stop","metrics":{"input_tokens":9},"points":null},"index":6}',
      "",
      'data: {"id":"a","output":[{"answer":"The","finish_reason":""},{"answer":"The capital of France is Paris.","finish_reason":"stop","metrics":{"input_tokens":9}}],"status":"succeeded"}',
      "",
      'data: {"response":"","usage":{"neurons":2.58}}',
      "",
      "data: [DONE]",
    ].join("\n");
    expect(moondreamStromLesen(strom)).toEqual({ answer: "The capital of France is Paris.", finish_reason: "stop", metrics: { input_tokens: 9 } });
  });

  it("holt Punkte aus dem Datenstrom und meldet Fehler im Strom", () => {
    const strom = 'data: {"chunk":{"finish_reason":"stop","metrics":{},"points":[{"x":0.4,"y":0.6}]}}\n\ndata: [DONE]\n';
    const r = moondreamStromLesen(strom);
    expect(moondreamAntwortFehler(r)).toBeNull();
    expect(moondreamRohpunkte(r)).toEqual([{ x: 0.4, y: 0.6 }]);
    expect(() => moondreamStromLesen('data: {"errors":[{"message":"kaputt"}]}\n')).toThrow(/Fehler im Datenstrom/);
    expect(() => moondreamStromLesen('data: {"status":"failed"}\n')).toThrow(/Fehler im Datenstrom/);
    expect(() => moondreamStromLesen("data: [DONE]\n")).toThrow(/ohne Ergebnis/);
  });

  it("liest Punkte aus dem Antworttext der Frage, auch mit Code-Zaun oder Text drumherum", () => {
    expect(textPunkte('{"points":[{"x":0.2,"y":0.3},{"x":0.7,"y":0.8}]}')).toEqual([
      { x: 0.2, y: 0.3 },
      { x: 0.7, y: 0.8 },
    ]);
    expect(textPunkte('Here you go:\n```json\n{"points":[{"x":0.5,"y":0.5}]}\n```')).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(textPunkte("[[0.1,0.9]]")).toEqual([{ x: 0.1, y: 0.9 }]);
    expect(textPunkte('{"points":[]}')).toEqual([]);
    expect(textPunkte("I cannot see any scissors.")).toEqual([]);
    expect(moondreamFrage("scissors")).toContain("every single visible scissors");
  });

  it("nimmt Punkte aus Antwort, sonst aus dem Nachdenken des Modells", () => {
    expect(moondreamAntwortPunkte({ answer: '{"points":[{"x":0.4,"y":0.6}]}', finish_reason: "stop" })).toEqual([{ x: 0.4, y: 0.6 }]);
    expect(
      moondreamAntwortPunkte({
        answer: "There are two.",
        finish_reason: "stop",
        reasoning: { text: "…", grounding: [{ start_idx: 0, end_idx: 5, points: [[0.1, 0.2], [0.3, 0.4]] }, { points: [{ x: 0.5, y: 0.6 }] }] },
      }),
    ).toEqual([
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.4 },
      { x: 0.5, y: 0.6 },
    ]);
    expect(moondreamAntwortPunkte({ answer: "none", reasoning: { grounding: [] } })).toEqual([]);
    expect(moondreamAntwortPunkte({ points: [{ x: 0.9, y: 0.1 }] })).toEqual([{ x: 0.9, y: 0.1 }]);
  });

  it("erkennt, ob das Modell überhaupt gerechnet hat", () => {
    expect(moondreamAntwortFehler({ finish_reason: "stop", metrics: {}, points: [] })).toBeNull();
    expect(moondreamAntwortFehler({ finish_reason: "stop", points: null })).toBeNull();
    expect(moondreamAntwortFehler({ result: { finish_reason: "stop", points: [{ x: 0.1, y: 0.2 }] }, success: true })).toBeNull();
    expect(moondreamAntwortFehler({})).toMatch(/^Antwort ohne Punkte \(Felder: keine\)/);
    expect(moondreamAntwortFehler({ foo: 1 })).toMatch(/Felder: foo/);
    expect(moondreamAntwortFehler({ errors: [{ message: "x" }] })).toMatch(/^Fehler vom Modell/);
    expect(moondreamAntwortFehler(null)).toMatch(/kein Objekt/);
    expect(moondreamAntwortFehler("text")).toMatch(/kein Objekt/);
  });

  it("kürzt Rohantworten und entfernt Bilddaten", () => {
    expect(antwortKurz({ image: "data:image/jpeg;base64,AAAA", points: [] })).toBe('{"image":"data:image/…","points":[]}');
    expect(antwortKurz("x".repeat(700)).length).toBeLessThan(610);
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

  it("Moondream ohne erreichbares Workers AI meldet den Fehler statt „nichts gefunden“", async () => {
    const admin = await adminEinrichten();
    const r = await admin.post("/zaehlen", { modell: "moondream", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] });
    expect(r.status).toBe(502);
    expect(r.daten.fehler).toMatch(/^Moondream hat nicht geantwortet: ./);
  });

  it("Gemini ohne Schlüssel ist nicht eingerichtet", async () => {
    const admin = await adminEinrichten();
    expect((await admin.get("/zaehlen/modelle")).daten.gemini).toBe(false);
    const r = await admin.post("/zaehlen", { modell: "gemini", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] });
    expect(r.status).toBe(409);
  });
});

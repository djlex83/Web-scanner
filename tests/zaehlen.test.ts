import { describe, expect, it } from "vitest";
import {
  aktiveZiele,
  antwortKurz,
  CLOUDFLARE_BILDMODELLE,
  cloudflareAntwortText,
  codesZuPunkten,
  datenUrlTeile,
  doppeltePunkteEntfernen,
  googleAntwortText,
  googleModell,
  MAX_ZIELE,
  modellPunkte,
  zaehlAnweisung,
  ZAEHL_MODELLE,
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

  it("ohne eingetragene Art ist nichts zu zählen (Fotoknöpfe bleiben gesperrt)", () => {
    expect(aktiveZiele([{ text: "  ", soll: 0 }])).toEqual([]);
    expect(aktiveZiele([])).toEqual([]);
    expect(aktiveZiele([{ text: " Koffer ", soll: 2 }, { text: "", soll: 0 }])).toEqual([{ text: "Koffer", soll: 2 }]);
  });
});

describe("Zählhilfe: Anweisung an das Modell", () => {
  it("nummeriert die Arten und verlangt Anzahl, Punkte und Beschriftung", () => {
    const a = zaehlAnweisung(["Akkuschrauber", "Koffer"]);
    expect(a).toContain("0: Akkuschrauber");
    expect(a).toContain("1: Koffer");
    expect(a).toContain('"anzahl"');
    expect(a).toContain('"text"');
    expect(a).toMatch(/Angeschnittene Böden/);
  });

  it("enthält keine Beispielzahlen, die ein Modell abschreiben könnte", () => {
    // Moondream hat ein Beispiel mit zwei Punkten wörtlich übernommen und immer 2 gezählt
    const a = zaehlAnweisung(["Gleiter"]);
    expect(a).not.toMatch(/"(?:y|x|anzahl|ziel)"\s*:\s*\d/);
    expect(a).not.toMatch(/\{\s*"/);
  });
});

describe("Zählhilfe: Antworten der Modelle", () => {
  it("liest y/x auf 0–1000, auch als point-Array, auch in Code-Zaun", () => {
    const text = '```json\n{"punkte":[{"ziel":1,"y":250,"x":500},{"ziel":7,"point":[100,900]},{"ziel":0,"y":1200,"x":10}]}\n```';
    expect(modellPunkte(text, 2).punkte).toEqual([
      { x: 0.5, y: 0.25, ziel: 1 },
      { x: 0.9, y: 0.1, ziel: null },
    ]);
    expect(modellPunkte('[{"ziel":0,"y":0,"x":0}]', 1).punkte).toEqual([{ x: 0, y: 0, ziel: 0 }]);
    expect(() => modellPunkte("kein json", 1)).toThrow();
    expect(() => modellPunkte('{"anders":1}', 1)).toThrow();
  });

  it("liest Text um das JSON herum, die genannte Anzahl und Beschriftungen", () => {
    const r = modellPunkte(
      'Ich sehe drei Gleiter:\n{"anzahl":3,"punkte":[{"ziel":0,"y":500,"x":300,"text":"  T808 "},{"ziel":0,"y":500,"x":600,"text":""},{"ziel":0,"y":600,"x":450,"text":"' +
        "x".repeat(40) +
        '"}]}\nFertig.',
      1,
    );
    expect(r.anzahl).toBe(3);
    expect(r.punkte[0]).toEqual({ x: 0.3, y: 0.5, ziel: 0, text: "T808" });
    expect(r.punkte[1]).toEqual({ x: 0.6, y: 0.5, ziel: 0 });
    expect(r.punkte[2]!.text).toHaveLength(24);
    expect(modellPunkte('{"anzahl":"viele","punkte":[]}', 1).anzahl).toBeUndefined();
  });

  it("Cloudflare-Bildmodelle: Antworttext in altem und neuem Format", () => {
    expect(cloudflareAntwortText({ response: '{"punkte":[]}' })).toBe('{"punkte":[]}');
    expect(cloudflareAntwortText({ response: { punkte: [] } })).toBe('{"punkte":[]}');
    expect(cloudflareAntwortText({ choices: [{ message: { content: "abc" } }] })).toBe("abc");
    expect(cloudflareAntwortText({ choices: [{ message: { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] } }] })).toBe("ab");
    expect(cloudflareAntwortText({ result: { response: "x" } })).toBe("x");
    expect(cloudflareAntwortText({})).toBe("");
    expect(Object.keys(CLOUDFLARE_BILDMODELLE).every((k) => (ZAEHL_MODELLE as readonly string[]).includes(k))).toBe(true);
  });

  it("Gemini direkt bei Google: Modellname, Bildteile, Antworttext ohne Gedanken", () => {
    expect(googleModell("google/gemini-3.6-flash")).toBe("gemini-3.6-flash");
    expect(googleModell(" gemini-x ")).toBe("gemini-x");
    expect(datenUrlTeile("data:image/jpeg;base64,/9j/4AAQ")).toEqual({ typ: "image/jpeg", daten: "/9j/4AAQ" });
    expect(() => datenUrlTeile("http://x/bild.jpg")).toThrow();
    expect(
      googleAntwortText({
        candidates: [{ content: { parts: [{ text: "überlege …", thought: true }, { text: '{"punkte":' }, { text: "[]}" }] }, finishReason: "STOP" }],
      }),
    ).toEqual({ text: '{"punkte":[]}', ende: "STOP" });
    expect(googleAntwortText({ promptFeedback: { blockReason: "SAFETY" } })).toEqual({ text: "", ende: "SAFETY" });
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

  it("lässt dicht beieinanderliegende Teile derselben Art stehen (gestapelte Scheren)", () => {
    const punkte = [
      { x: 0.5, y: 0.5, ziel: 0 },
      { x: 0.505, y: 0.5, ziel: 0 },
      { x: 0.51, y: 0.505, ziel: 0 },
    ];
    expect(doppeltePunkteEntfernen(punkte, 1000, 1000)).toEqual(punkte);
  });

  it("fasst deckungsgleiche Punkte derselben Art zusammen", () => {
    const punkte = [
      { x: 0.45, y: 0.4, ziel: null },
      { x: 0.45, y: 0.4, ziel: null },
      { x: 0.451, y: 0.4, ziel: null },
    ];
    expect(doppeltePunkteEntfernen(punkte, 960, 1280)).toEqual([punkte[0]]);
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
    const r = await new Client().post("/zaehlen", { modell: "qwen", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] });
    expect(r.status).toBe(401);
  });

  it("prüft Foto, Arten und Modell; Moondream gibt es nicht mehr", async () => {
    const admin = await adminEinrichten();
    expect((await admin.post("/zaehlen", { modell: "qwen", bild: "http://x", breite: 640, hoehe: 480, ziele: ["Koffer"] })).status).toBe(400);
    expect((await admin.post("/zaehlen", { modell: "qwen", bild, breite: 640, hoehe: 480, ziele: [] })).status).toBe(400);
    expect((await admin.post("/zaehlen", { modell: "anders", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] })).status).toBe(400);
    expect((await admin.post("/zaehlen", { modell: "moondream", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] })).status).toBe(400);
  });

  it("Cloudflare-Bildmodelle sind über die Bindung verfügbar und melden Fehler statt „nichts gefunden“", async () => {
    const admin = await adminEinrichten();
    const da = (await admin.get("/zaehlen/modelle")).daten;
    expect(Object.keys(da).sort()).toEqual([...ZAEHL_MODELLE].sort());
    expect(da.qwen).toBe(true);
    // In den Tests ist Workers AI nicht erreichbar: Fehler vom Modell, aber kein 400 (Modell gültig)
    const r = await admin.post("/zaehlen", { modell: "qwen", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] });
    expect(r.status).toBe(502);
    expect(r.daten.fehler).toMatch(/^Qwen 3\.8 \(Cloudflare\) hat nicht geantwortet: ./);
  });

  it("Gemini ohne Schlüssel ist nicht eingerichtet", async () => {
    const admin = await adminEinrichten();
    expect((await admin.get("/zaehlen/modelle")).daten.gemini).toBe(false);
    const r = await admin.post("/zaehlen", { modell: "gemini", bild, breite: 640, hoehe: 480, ziele: ["Koffer"] });
    expect(r.status).toBe(409);
  });
});

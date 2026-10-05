// Druckvorlagen für Platz-Etiketten. Alle Maße in mm.

export type Papier = { breite: number; hoehe: number; name: string };

export type Vorlage = {
  id: string;
  gruppe: "Etikettenbogen" | "Normales Papier" | "Etikettendrucker";
  /** Text in der Auswahl */
  name: string;
  papier: Papier;
  etikett: { breite: number; hoehe: number };
  spalten: number;
  zeilen: number;
  /** Abstand des ersten Etiketts vom Blattrand; leer = mittig */
  oben?: number;
  links?: number;
  /** Zwischenraum zwischen den Etiketten */
  abstandX: number;
  abstandY: number;
  /** Schnittlinien zeichnen (normales Papier zum Ausschneiden) */
  schnitt?: boolean;
};

export const PAPIER = {
  a4: { breite: 210, hoehe: 297, name: "A4" },
  a4quer: { breite: 297, hoehe: 210, name: "A4 quer" },
  a5quer: { breite: 210, hoehe: 148, name: "A5 quer" },
  a6quer: { breite: 148, hoehe: 105, name: "A6 quer" },
} satisfies Record<string, Papier>;

export const VORLAGEN: Vorlage[] = [
  // Gängige A4-Etikettenbögen (Maße wie Avery Zweckform L7160 / L7163 / L7165)
  { id: "a4-21", gruppe: "Etikettenbogen", name: "A4 · 21 Etiketten (63,5 × 38,1 mm)", papier: PAPIER.a4, etikett: { breite: 63.5, hoehe: 38.1 }, spalten: 3, zeilen: 7, oben: 15.15, links: 7.2, abstandX: 2.5, abstandY: 0 },
  { id: "a4-14", gruppe: "Etikettenbogen", name: "A4 · 14 Etiketten (99,1 × 38,1 mm)", papier: PAPIER.a4, etikett: { breite: 99.1, hoehe: 38.1 }, spalten: 2, zeilen: 7, oben: 15.15, links: 4.65, abstandX: 2.5, abstandY: 0 },
  { id: "a4-8", gruppe: "Etikettenbogen", name: "A4 · 8 Etiketten (99,1 × 67,7 mm)", papier: PAPIER.a4, etikett: { breite: 99.1, hoehe: 67.7 }, spalten: 2, zeilen: 4, oben: 13.1, links: 4.65, abstandX: 2.5, abstandY: 0 },
  // Schilder zum Ausschneiden oder direkt auf kleinerem Papier
  { id: "a4-schild-a6", gruppe: "Normales Papier", name: "A4 · 4 Schilder A6 zum Ausschneiden", papier: PAPIER.a4, etikett: { breite: 105, hoehe: 148.5 }, spalten: 2, zeilen: 2, oben: 0, links: 0, abstandX: 0, abstandY: 0, schnitt: true },
  { id: "a4-schild-a5", gruppe: "Normales Papier", name: "A4 · 2 Schilder A5 zum Ausschneiden", papier: PAPIER.a4, etikett: { breite: 210, hoehe: 148.5 }, spalten: 1, zeilen: 2, oben: 0, links: 0, abstandX: 0, abstandY: 0, schnitt: true },
  { id: "a4-schild", gruppe: "Normales Papier", name: "A4 quer · 1 großes Schild", papier: PAPIER.a4quer, etikett: { breite: 297, hoehe: 210 }, spalten: 1, zeilen: 1, oben: 0, links: 0, abstandX: 0, abstandY: 0 },
  { id: "a5-schild", gruppe: "Normales Papier", name: "A5 quer · 1 Schild", papier: PAPIER.a5quer, etikett: { breite: 210, hoehe: 148 }, spalten: 1, zeilen: 1, oben: 0, links: 0, abstandX: 0, abstandY: 0 },
  { id: "a6-schild", gruppe: "Normales Papier", name: "A6 quer · 1 Schild", papier: PAPIER.a6quer, etikett: { breite: 148, hoehe: 105 }, spalten: 1, zeilen: 1, oben: 0, links: 0, abstandX: 0, abstandY: 0 },
];

export const EIGEN_ID = "eigen";
export const EIGEN_START = { breite: 62, hoehe: 29 };
export const EIGEN_GRENZEN = { min: 20, max: 300 };

/** Vorlage für Etikettendrucker (Rolle): ein Etikett je Seite in eigener Größe. */
export function eigeneVorlage(breite: number, hoehe: number): Vorlage {
  const b = begrenzen(breite);
  const h = begrenzen(hoehe);
  return {
    id: EIGEN_ID,
    gruppe: "Etikettendrucker",
    name: `Etikettendrucker · ${zahl(b)} × ${zahl(h)} mm`,
    papier: { breite: b, hoehe: h, name: `${zahl(b)} × ${zahl(h)} mm` },
    etikett: { breite: b, hoehe: h },
    spalten: 1,
    zeilen: 1,
    oben: 0,
    links: 0,
    abstandX: 0,
    abstandY: 0,
  };
}

/** Gespeicherte Auswahl auflösen; unbekannte Werte (auch aus älteren Versionen) → Standard. */
export function vorlageFinden(id: string, eigen: { breite: number; hoehe: number }): Vorlage {
  if (id === EIGEN_ID) return eigeneVorlage(eigen.breite, eigen.hoehe);
  if (id === "gross") return VORLAGEN.find((v) => v.id === "a4-8")!;
  return VORLAGEN.find((v) => v.id === id) ?? VORLAGEN[0];
}

export type Position = { links: number; oben: number };

/** Lage des n-ten Etiketts auf dem Blatt; ohne feste Ränder wird das Raster mittig gesetzt. */
export function position(v: Vorlage, n: number): Position {
  const spalte = n % v.spalten;
  const zeile = Math.floor(n / v.spalten) % v.zeilen;
  const rasterB = v.spalten * v.etikett.breite + (v.spalten - 1) * v.abstandX;
  const rasterH = v.zeilen * v.etikett.hoehe + (v.zeilen - 1) * v.abstandY;
  const links = v.links ?? (v.papier.breite - rasterB) / 2;
  const oben = v.oben ?? (v.papier.hoehe - rasterH) / 2;
  return {
    links: links + spalte * (v.etikett.breite + v.abstandX),
    oben: oben + zeile * (v.etikett.hoehe + v.abstandY),
  };
}

export type Gestaltung = {
  /** Innenabstand des Etiketts */
  rand: number;
  /** Kantenlänge des QR-Codes */
  qr: number;
  /** QR oben, Text darunter (hohe Etiketten) statt QR links, Text rechts */
  hochkant: boolean;
  /** Schriftgrößen in pt */
  name: number;
  eltern: number;
  code: number;
};

const PT = 0.3528; // mm je Punkt
const ZEICHEN = 0.62; // mittlere Zeichenbreite fett, in em

/** QR-Größe, Anordnung und Schriftgrößen passend zur Etikettengröße. */
export function gestaltung(v: Vorlage, name: string): Gestaltung {
  const { breite, hoehe } = v.etikett;
  const rand = Math.min(4, Math.max(1.5, Math.min(breite, hoehe) * 0.1));
  const hochkant = hoehe > breite * 0.9;
  const innenB = breite - 2 * rand;
  const innenH = hoehe - 2 * rand;
  const qr = hochkant ? Math.min(innenB, innenH * 0.6) : Math.min(innenH, breite * 0.45);
  const textB = hochkant ? innenB : innenB - qr - 3;
  const textH = hochkant ? innenH - qr - 3 : innenH;

  const maxPt = Math.min(72, textH * (hochkant ? 0.75 : 0.49));
  const minPt = Math.max(6, maxPt * 0.5);
  const laengstesWort = Math.max(1, ...name.split(/\s+/).map((w) => w.length));
  const passt = (textB * 0.85) / (laengstesWort * ZEICHEN * PT);
  return {
    rand,
    qr,
    hochkant,
    name: runden(Math.max(minPt, Math.min(maxPt, passt))),
    eltern: runden(Math.max(6, Math.min(maxPt * 0.6, Math.max(9, maxPt * 0.35)))),
    code: runden(Math.max(5, Math.min(maxPt * 0.45, Math.max(7, maxPt * 0.22)))),
  };
}

function begrenzen(mm: number): number {
  if (!Number.isFinite(mm)) return EIGEN_GRENZEN.min;
  return Math.min(EIGEN_GRENZEN.max, Math.max(EIGEN_GRENZEN.min, Math.round(mm * 10) / 10));
}

function runden(pt: number): number {
  return Math.round(pt * 10) / 10;
}

function zahl(mm: number): string {
  return mm.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

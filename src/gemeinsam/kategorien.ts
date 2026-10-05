// Symbole und Farben für Kategorien. Ohne eigene Einstellung wird beides aus dem Namen
// abgeleitet, damit Listen von Anfang an übersichtlich aussehen.

export const SYMBOLE = [
  "box", "wrench", "hammer", "drill", "ruler", "gauge", "thermometer", "microscope",
  "zap", "plug", "cable", "battery", "lightbulb", "fan",
  "laptop", "monitor", "smartphone", "printer", "camera", "server", "headphones", "radio",
  "truck", "forklift", "car", "bike",
  "package", "archive", "cylinder", "droplet", "flame", "flask",
  "hardhat", "shield", "shirt", "stethoscope",
  "paintbrush", "scissors", "key", "book", "cog", "armchair", "utensils",
] as const;
export type Symbol = (typeof SYMBOLE)[number];

export const FARBEN = ["grau", "blau", "gruen", "gelb", "orange", "rot", "lila", "pink", "tuerkis"] as const;
export type Farbe = (typeof FARBEN)[number];

export const FARBE_NAME: Record<Farbe, string> = {
  grau: "Grau",
  blau: "Blau",
  gruen: "Grün",
  gelb: "Gelb",
  orange: "Orange",
  rot: "Rot",
  lila: "Lila",
  pink: "Pink",
  tuerkis: "Türkis",
};

export interface KategorieStil {
  symbol: Symbol;
  farbe: Farbe;
}

export interface Kategorie extends KategorieStil {
  name: string;
  /** Stücke mit dieser Kategorie (ohne ausgemusterte) */
  anzahl: number;
  /** true = von der Leitung festgelegt, false = automatisch */
  eigen: boolean;
}

export const OHNE_KATEGORIE: KategorieStil = { symbol: "box", farbe: "grau" };

// Stichwörter → Symbol (Reihenfolge = Vorrang)
const STICHWORTE: [RegExp, Symbol, Farbe][] = [
  [/bohr|akku.?schraub/, "drill", "blau"],
  [/werkzeug|schraub|zange|maulschlüssel|drehmoment|ratsche/, "wrench", "blau"],
  [/hammer/, "hammer", "blau"],
  [/mess|prüf|test|kalib/, "gauge", "gruen"],
  [/temperatur|thermo/, "thermometer", "gruen"],
  [/labor|mikroskop/, "microscope", "tuerkis"],
  [/elektr|strom|spannung/, "zap", "gelb"],
  [/kabel|leitung/, "cable", "gelb"],
  [/stecker|adapter|verteiler/, "plug", "gelb"],
  [/akku|batterie/, "battery", "gelb"],
  [/lampe|leucht|licht/, "lightbulb", "gelb"],
  [/laptop|notebook|computer|\bpc\b|\bit\b|edv/, "laptop", "lila"],
  [/monitor|bildschirm/, "monitor", "lila"],
  [/handy|telefon|smartphone|tablet/, "smartphone", "lila"],
  [/drucker/, "printer", "lila"],
  [/kamera|foto/, "camera", "lila"],
  [/server|netzwerk/, "server", "lila"],
  [/funk|radio/, "radio", "lila"],
  [/stapler|hubwagen/, "forklift", "orange"],
  [/transport|wagen|lkw|anhänger/, "truck", "orange"],
  [/fahrzeug|auto|pkw/, "car", "orange"],
  [/verpack|karton|paket/, "package", "orange"],
  [/archiv|akte|ordner/, "archive", "grau"],
  [/gas|flasche/, "cylinder", "rot"],
  [/brand|feuer|lösch/, "flame", "rot"],
  [/chemie|reinig|flüssig/, "flask", "tuerkis"],
  [/wasser|öl|schmier/, "droplet", "tuerkis"],
  [/psa|schutz|sicherheit|helm/, "hardhat", "rot"],
  [/kleid|jacke|shirt|textil/, "shirt", "pink"],
  [/erste.?hilfe|medizin|sanität/, "stethoscope", "rot"],
  [/farbe|maler|pinsel/, "paintbrush", "pink"],
  [/schlüssel|zugang/, "key", "grau"],
  [/buch|handbuch|doku|anleitung/, "book", "grau"],
  [/maschine|ersatzteil|motor/, "cog", "grau"],
  [/möbel|stuhl|tisch/, "armchair", "pink"],
  [/küche|geschirr/, "utensils", "pink"],
];

/** Automatischer Stil aus dem Kategorienamen. */
export function standardStil(name: string | null | undefined): KategorieStil {
  if (!name) return OHNE_KATEGORIE;
  const n = name.toLowerCase();
  for (const [muster, symbol, farbe] of STICHWORTE) if (muster.test(n)) return { symbol, farbe };
  // Unbekannt: Kiste in einer Farbe, die sich aus dem Namen ergibt (immer gleich)
  let h = 0;
  for (const z of n) h = (h * 31 + z.charCodeAt(0)) >>> 0;
  const farben = FARBEN.filter((f) => f !== "grau");
  return { symbol: "box", farbe: farben[h % farben.length]! };
}

export function istSymbol(w: unknown): w is Symbol {
  return typeof w === "string" && (SYMBOLE as readonly string[]).includes(w);
}

export function istFarbe(w: unknown): w is Farbe {
  return typeof w === "string" && (FARBEN as readonly string[]).includes(w);
}

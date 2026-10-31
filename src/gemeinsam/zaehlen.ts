// Zählhilfe: Was gezählt wird (Ziele), was das Bildmodell gesagt bekommt, wie seine Antwort gelesen wird
// und wie Punkte und Strichcodes zusammenkommen. Reine Funktionen – von Server, Oberfläche und Tests genutzt.

/**
 * Bildmodelle bei Cloudflare Workers AI, die per Chat (Text + Bild) angesprochen werden.
 * Laufen über die Bindung `AI` – kein eigener Schlüssel nötig, Gratis-Kontingent 10 000 Neurons/Tag.
 */
export const CLOUDFLARE_BILDMODELLE = {
  llama4: "@cf/meta/llama-4-scout-17b-16e-instruct",
  qwen: "@cf/qwen/qwen3.8-27b",
  gemma4: "@cf/google/gemma-4-26b-a4b-it",
  kimi: "@cf/moonshotai/kimi-k2.6",
  mistral: "@cf/mistralai/mistral-small-3.1-24b-instruct",
} as const;
export type CloudflareBildmodell = keyof typeof CLOUDFLARE_BILDMODELLE;

/**
 * Reihenfolge in der Auswahl; vorgewählt wird das erste eingerichtete (bzw. das zuletzt benutzte).
 * Qwen zuerst: im ersten Test (Oktober 2026, drei überlappende Möbelgleiter) zählten Qwen und Llama 4
 * richtig 3, Qwen setzte die Punkte genauer.
 */
export const ZAEHL_MODELLE = ["qwen", "llama4", "gemini", "gemma4", "kimi", "mistral"] as const;
export type ZaehlModell = (typeof ZAEHL_MODELLE)[number];

export const ZAEHL_MODELL_NAME: Record<ZaehlModell, string> = {
  qwen: "Qwen 3.8 (Cloudflare)",
  llama4: "Llama 4 Scout (Cloudflare)",
  gemini: "Gemini (Google)",
  gemma4: "Gemma 4 (Cloudflare)",
  kimi: "Kimi K2.6 (Cloudflare)",
  mistral: "Mistral Small 3.1 (Cloudflare)",
};

/** Höchstens so viele Arten je Foto – mehr verwirrt die Modelle und macht die Liste unübersichtlich. */
export const MAX_ZIELE = 6;
export const MAX_ZIEL_TEXT = 120;
/** Längste Beschriftung, die je Punkt übernommen wird (z. B. „T808“). */
export const MAX_BESCHRIFTUNG = 24;

/** Eine Art von Stücken, die auf dem Foto gezählt werden soll. */
export interface ZaehlZiel {
  /** Text für das Modell, z. B. „Akkuschrauber: blauer Koffer, 18 V“ */
  text: string;
  /** so viele liegen laut System hier */
  soll: number;
}

/** Arten, die tatsächlich gezählt werden: leere Einträge fallen weg. Ohne solche Arten ist kein Foto sinnvoll. */
export const aktiveZiele = (ziele: ZaehlZiel[]): ZaehlZiel[] => ziele.map((z) => ({ ...z, text: z.text.trim() })).filter((z) => z.text);

/**
 * Ein Punkt auf dem Foto, Koordinaten 0–1. `ziel` = Index in der Ziel-Liste, null = von Hand ohne Art.
 * `text` = Beschriftung, die das Modell auf oder direkt am Teil gelesen hat (z. B. „T808“).
 */
export interface ZaehlPunkt {
  x: number;
  y: number;
  ziel: number | null;
  text?: string;
}

/** Ein Aufruf beim Modell – für die Fehlersuche in der App und im Cloudflare-Log. */
export interface ZaehlVersuch {
  /** Modell und Weg, z. B. „@cf/qwen/qwen3.8-27b · 2 Arten“ */
  gesendet: string;
  punkte: number;
  dauerMs: number;
  /** Anzahl, die das Modell selbst nennt – weicht sie von den Punkten ab, hat es sich verzählt */
  anzahl?: number;
  fehler?: string;
  /** gekürzte Rohantwort */
  antwort?: string;
}

export interface ZaehlDiagnose {
  bildKb: number;
  breite: number;
  hoehe: number;
  versuche: ZaehlVersuch[];
}

export interface ZaehlAntwort {
  modell: ZaehlModell;
  punkte: ZaehlPunkt[];
  diagnose: ZaehlDiagnose;
}

/** Rohantwort für die Diagnose: JSON, gekürzt, ohne Bilddaten. */
export function antwortKurz(r: unknown, max = 600): string {
  let t: string;
  try {
    t = typeof r === "string" ? r : JSON.stringify(r);
  } catch {
    t = String(r);
  }
  t = (t ?? "").replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "data:image/…");
  return t.length > max ? t.slice(0, max) + " …" : t;
}

export interface ZielQuelle {
  name: string;
  kategorie: string | null;
  beschreibung: string | null;
}

const kuerzen = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const schnitt = t.slice(0, max - 1);
  const wort = schnitt.lastIndexOf(" ");
  return (wort > max * 0.6 ? schnitt.slice(0, wort) : schnitt).replace(/[\s,.;:–-]+$/, "") + "…";
};

/**
 * Vorschlag aus den Stücken des Regals: gruppiert nach Kategorie (sonst nach Name).
 * Text = Kategorie bzw. Name, dazu kurz die Beschreibung – daran erkennt das Modell, was gemeint ist.
 * Bei mehreren verschiedenen Stücken einer Kategorie werden deren Namen genannt.
 */
export function zieleVorschlagen(stuecke: ZielQuelle[]): ZaehlZiel[] {
  const gruppen = new Map<string, { titel: string; namen: Set<string>; beschreibung: string | null; soll: number }>();
  for (const s of stuecke) {
    const titel = (s.kategorie ?? "").trim() || s.name.trim();
    const schluessel = titel.toLocaleLowerCase("de");
    const g = gruppen.get(schluessel) ?? { titel, namen: new Set<string>(), beschreibung: null, soll: 0 };
    g.soll++;
    g.namen.add(s.name.trim());
    if (!g.beschreibung && s.beschreibung?.trim()) g.beschreibung = s.beschreibung.trim();
    gruppen.set(schluessel, g);
  }
  return [...gruppen.values()]
    .sort((a, b) => b.soll - a.soll || a.titel.localeCompare(b.titel, "de"))
    .slice(0, MAX_ZIELE)
    .map((g) => {
      const namen = [...g.namen].filter((n) => n.toLocaleLowerCase("de") !== g.titel.toLocaleLowerCase("de"));
      const zusatz = namen.length > 1 ? namen.slice(0, 3).join(", ") : [namen[0], g.beschreibung].filter(Boolean).join(", ");
      return { text: kuerzen(zusatz ? `${g.titel}: ${zusatz}` : g.titel, MAX_ZIEL_TEXT), soll: g.soll };
    });
}

/**
 * Anweisung an das Bildmodell (für alle Modelle gleich). Die Arten sind nummeriert, damit jeder Punkt
 * einer Art zugeordnet werden kann. Das Format wird nur in Worten beschrieben – ein Beispiel mit konkreten
 * Zahlen hat ein Modell (Moondream, Oktober 2026) wörtlich abgeschrieben und immer gleich gezählt.
 */
export function zaehlAnweisung(ziele: string[]): string {
  return [
    "Du hilfst bei der Inventur in einem Lager. Auf dem Foto ist ein Regalboden oder Fach.",
    "Setze für JEDES einzelne sichtbare Exemplar der folgenden Arten genau EINEN Punkt auf die Mitte des Teils:",
    ...ziele.map((t, i) => `${i}: ${t}`),
    "",
    "Vorgehen und Regeln:",
    "- Gehe das Foto systematisch durch: Reihe für Reihe von hinten nach vorn, in jeder Reihe von links nach rechts.",
    "- Jedes physische Teil genau einmal, auch wenn es teilweise verdeckt ist. Nichts doppelt.",
    "- Gleiche Teile nebeneinander, hintereinander oder gestapelt einzeln zählen.",
    "- Zähle nur den Regalboden bzw. das Fach, das den größten Teil des Fotos einnimmt. Angeschnittene Böden am oberen oder unteren Bildrand nicht mitzählen.",
    "- Teile, die zu keiner Art passen, Regalböden, leere Halteplätze, Zettel, Etiketten und Hintergrund nicht markieren.",
    "- Bei Zweifel, welcher Art ein Teil angehört: die passendste wählen.",
    "- Steht auf oder direkt am Teil eine gut lesbare Nummer oder Beschriftung (z. B. auf einem Aufkleber oder handgeschrieben), gib sie als text an.",
    "",
    "Antworte NUR mit einem JSON-Objekt mit zwei Feldern:",
    '- "anzahl": wie viele Teile du insgesamt gezählt hast.',
    '- "punkte": eine Liste mit genau so vielen Einträgen, je Teil ein Objekt mit "ziel" (Nummer der Art), "y" und "x" (Mitte des Teils, beide auf 0 bis 1000 normiert, 0,0 = oben links) und optional "text" (gelesene Beschriftung).',
  ].join("\n");
}

const imBild = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;

/** JSON aus einer Modellantwort holen – auch mit Text oder Code-Zaun drumherum. */
function jsonAusText(text: string): unknown {
  const ohneZaun = text.replace(/```(?:json)?/g, "").trim();
  const kandidaten = [ohneZaun, ohneZaun.match(/\{[\s\S]*\}/)?.[0], ohneZaun.match(/\[[\s\S]*\]/)?.[0]].filter(Boolean) as string[];
  for (const k of kandidaten) {
    try {
      return JSON.parse(k) as unknown;
    } catch {
      /* nächster Kandidat */
    }
  }
  throw new Error("Antwort des Modells war kein gültiges JSON");
}

/**
 * Punkte aus der Antwort des Modells: JSON mit `punkte` (oder nackte Liste), je Punkt `y`/`x` auf 0–1000
 * (Googles Konvention, alle Modelle bekommen sie so gesagt) oder `point: [y, x]`, dazu `ziel` und optional `text`.
 * `anzahl` ist die Zahl, die das Modell selbst nennt.
 */
export function modellPunkte(text: string, anzahlZiele: number): { punkte: ZaehlPunkt[]; anzahl?: number } {
  const daten = jsonAusText(text);
  const liste = Array.isArray(daten) ? daten : (daten as { punkte?: unknown })?.punkte;
  if (!Array.isArray(liste)) throw new Error("Antwort des Modells enthielt keine Punkte");
  const punkte: ZaehlPunkt[] = [];
  for (const e of liste as Record<string, unknown>[]) {
    const pt = Array.isArray(e?.point) ? (e.point as number[]) : null;
    const y = Number(pt ? pt[0] : e?.y) / 1000;
    const x = Number(pt ? pt[1] : e?.x) / 1000;
    const z = Number(e?.ziel);
    if (!imBild(x) || !imBild(y)) continue;
    const p: ZaehlPunkt = { x, y, ziel: Number.isInteger(z) && z >= 0 && z < anzahlZiele ? z : null };
    const t = typeof e?.text === "string" ? e.text.replace(/\s+/g, " ").trim().slice(0, MAX_BESCHRIFTUNG) : "";
    if (t) p.text = t;
    punkte.push(p);
  }
  const n = Number((daten as { anzahl?: unknown })?.anzahl);
  return Number.isInteger(n) && n >= 0 ? { punkte, anzahl: n } : { punkte };
}

/**
 * Antworttext eines Chat-Modells bei Cloudflare. Ältere Modelle liefern `response` (Text oder schon
 * geparstes JSON), neuere das OpenAI-Format `choices[0].message.content` (Text oder Liste von Teilen).
 */
export function cloudflareAntwortText(r: unknown): string {
  const o = (r ?? {}) as Record<string, unknown>;
  const kern = (o.result && typeof o.result === "object" ? o.result : o) as Record<string, unknown>;
  if (typeof kern.response === "string") return kern.response;
  if (kern.response && typeof kern.response === "object") return JSON.stringify(kern.response);
  const inhalt = (kern.choices as { message?: { content?: unknown } }[] | undefined)?.[0]?.message?.content;
  if (typeof inhalt === "string") return inhalt;
  if (Array.isArray(inhalt)) return inhalt.map((t) => (typeof t === "string" ? t : ((t as { text?: string })?.text ?? ""))).join("");
  return "";
}

/** Modellname für Googles eigene Schnittstelle: ohne den OpenRouter-Vorsatz „google/“. */
export const googleModell = (modell: string) => modell.trim().replace(/^google\//, "");

/** Daten-URL in Inhaltstyp und Base64-Teil zerlegen (Google will beides getrennt). */
export function datenUrlTeile(datenUrl: string): { typ: string; daten: string } {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(datenUrl);
  if (!m) throw new Error("Foto ist keine Base64-Daten-URL");
  return { typ: m[1]!, daten: m[2]! };
}

/**
 * Text aus einer Antwort von Googles generateContent: alle Textteile außer den Gedanken.
 * Dazu der Grund fürs Ende (STOP, MAX_TOKENS, SAFETY …) für die Diagnose.
 */
export function googleAntwortText(d: unknown): { text: string; ende: string } {
  const o = d as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  const k = o?.candidates?.[0];
  const text = (k?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  return { text, ende: k?.finishReason ?? o?.promptFeedback?.blockReason ?? "?" };
}

/**
 * Doppelte zusammenführen: Liegen zwei Punkte verschiedener Arten näher als `abstand` (Anteil der
 * Bilddiagonale), ist es dasselbe Teil, das unter zwei Arten gefunden wurde. Der erste gewinnt.
 * Punkte derselben Art bleiben stehen – gestapelte oder übereinanderliegende Teile liegen nun mal dicht
 * beieinander. Nur praktisch deckungsgleiche Punkte derselben Art (unter `gleich`) werden zu einem.
 */
export function doppeltePunkteEntfernen(punkte: ZaehlPunkt[], breite: number, hoehe: number, abstand = 0.025, gleich = 0.003): ZaehlPunkt[] {
  const diag = Math.hypot(breite, hoehe);
  const behalten: ZaehlPunkt[] = [];
  for (const p of punkte) {
    const doppelt = behalten.some((b) => Math.hypot((b.x - p.x) * breite, (b.y - p.y) * hoehe) < (b.ziel === p.ziel ? gleich : abstand) * diag);
    if (!doppelt) behalten.push(p);
  }
  return behalten;
}

/** Ein gelesener Strichcode, Mittelpunkt in 0–1. */
export interface CodeOrt {
  code: string;
  x: number;
  y: number;
}

/**
 * Jeden Code dem nächsten Punkt zuordnen (höchstens `maxAbstand` der Bilddiagonale entfernt,
 * jeder Punkt höchstens ein Code). Ergebnis: Punkt-Index → Code.
 */
export function codesZuPunkten(punkte: ZaehlPunkt[], codes: CodeOrt[], breite: number, hoehe: number, maxAbstand = 0.15): Map<number, string> {
  const diag = Math.hypot(breite, hoehe);
  const paare: { i: number; code: string; d: number }[] = [];
  for (const c of codes) {
    punkte.forEach((p, i) => {
      const d = Math.hypot((p.x - c.x) * breite, (p.y - c.y) * hoehe) / diag;
      if (d <= maxAbstand) paare.push({ i, code: c.code, d });
    });
  }
  paare.sort((a, b) => a.d - b.d);
  const zuordnung = new Map<number, string>();
  const vergeben = new Set<string>();
  for (const p of paare) {
    if (zuordnung.has(p.i) || vergeben.has(p.code)) continue;
    zuordnung.set(p.i, p.code);
    vergeben.add(p.code);
  }
  return zuordnung;
}

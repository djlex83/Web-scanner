// Zählhilfe: Was gezählt wird (Ziele), wie die Antworten der Bildmodelle gelesen werden und wie
// Punkte und Strichcodes zusammenkommen. Reine Funktionen – von Server, Oberfläche und Tests genutzt.

export type ZaehlModell = "moondream" | "gemini";

export const ZAEHL_MODELL_NAME: Record<ZaehlModell, string> = {
  moondream: "Moondream (Cloudflare)",
  gemini: "Gemini (Google)",
};

/** Höchstens so viele Arten je Foto – jede Art kostet bei Moondream eine eigene Anfrage. */
export const MAX_ZIELE = 6;
export const MAX_ZIEL_TEXT = 120;

/** Eine Art von Stücken, die auf dem Foto gezählt werden soll. */
export interface ZaehlZiel {
  /** Text für das Modell, z. B. „Akkuschrauber: blauer Koffer, 18 V“ */
  text: string;
  /** so viele liegen laut System hier */
  soll: number;
}

/** Ein Punkt auf dem Foto, Koordinaten 0–1. `ziel` = Index in der Ziel-Liste, null = von Hand ohne Art. */
export interface ZaehlPunkt {
  x: number;
  y: number;
  ziel: number | null;
}

/** Ein Aufruf beim Modell – für die Fehlersuche in der App und im Cloudflare-Log. */
export interface ZaehlVersuch {
  /** Index der Art, null = allgemeiner Notfall-Versuch */
  ziel: number | null;
  /** was tatsächlich ans Modell ging (bei Moondream: übersetzt) */
  gesendet: string;
  punkte: number;
  dauerMs: number;
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

/**
 * Punkte aus einer Moondream-Antwort holen, egal ob direkt (`points`), verschachtelt
 * (`result.points`, `output.points`) oder als Paare `[x, y]`.
 */
export function moondreamRohpunkte(r: unknown): { x: number; y: number }[] {
  const o = r as Record<string, unknown> | null;
  const kandidat = o?.points ?? (o?.result as Record<string, unknown> | undefined)?.points ?? (o?.output as Record<string, unknown> | undefined)?.points;
  if (!Array.isArray(kandidat)) return [];
  return kandidat
    .map((p) => (Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number((p as { x?: unknown })?.x), y: Number((p as { y?: unknown })?.y) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/**
 * Was Moondream nacheinander versucht, bis es Punkte findet: der volle übersetzte Text,
 * dann nur der Teil vor dem Doppelpunkt (Kategorie bzw. Name), zuletzt der deutsche Begriff –
 * die Übersetzung kann bei einzelnen Wörtern danebenliegen („Schere“ → „Shares“).
 */
export function moondreamKandidaten(englisch: string, original = ""): string[] {
  const voll = englisch.replace(/\s+/g, " ").trim();
  const kurz = voll.split(":")[0]!.trim();
  const deutsch = original.replace(/\s+/g, " ").trim().split(":")[0]!.trim();
  return [...new Set([voll, kurz, deutsch].filter(Boolean))];
}

/**
 * Eine echte Moondream-Antwort hat `finish_reason` und `metrics`, bei `point` dazu `points`
 * (leer, wenn nichts gefunden). Alles andere – etwa `{}` – heißt: das Modell hat nicht gerechnet.
 * Liefert die Beschreibung des Problems oder null, wenn die Antwort gültig ist.
 */
export function moondreamAntwortFehler(r: unknown): string | null {
  const o = r as Record<string, unknown> | null;
  const kern = (o?.result && typeof o.result === "object" && !("points" in o) ? o.result : o) as Record<string, unknown> | null;
  if (!kern || typeof kern !== "object") return `Antwort ist kein Objekt: ${antwortKurz(r, 200)}`;
  if (Array.isArray(kern.points) || typeof kern.finish_reason === "string") return null;
  if (typeof kern.error === "string" || Array.isArray(kern.errors)) return `Fehler vom Modell: ${antwortKurz(kern.error ?? kern.errors, 200)}`;
  return `Antwort ohne Punkte (Felder: ${Object.keys(kern).join(", ") || "keine"}): ${antwortKurz(r, 200)}`;
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

const imBild = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;

/**
 * Moondream liefert Punkte normiert auf 0–1. Sollte eine Version Pixel liefern,
 * werden sie über die Bildgröße umgerechnet. Alles außerhalb des Bildes fällt weg.
 */
export function moondreamPunkte(punkte: { x: number; y: number }[] | null | undefined, ziel: number, breite: number, hoehe: number): ZaehlPunkt[] {
  if (!punkte?.length) return [];
  const pixel = punkte.some((p) => p.x > 1.5 || p.y > 1.5);
  return punkte
    .map((p) => ({ x: pixel ? p.x / breite : p.x, y: pixel ? p.y / hoehe : p.y, ziel }))
    .filter((p) => imBild(p.x) && imBild(p.y));
}

/** Gemini antwortet mit JSON; Punkte als y/x auf 0–1000 (Googles eigene Konvention). */
export function geminiPunkte(text: string, anzahlZiele: number): ZaehlPunkt[] {
  const roh = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    throw new Error("Antwort des Modells war kein gültiges JSON");
  }
  const liste = Array.isArray(daten) ? daten : (daten as { punkte?: unknown })?.punkte;
  if (!Array.isArray(liste)) throw new Error("Antwort des Modells enthielt keine Punkte");
  const punkte: ZaehlPunkt[] = [];
  for (const e of liste as Record<string, unknown>[]) {
    const pt = Array.isArray(e?.point) ? (e.point as number[]) : null;
    const y = Number(pt ? pt[0] : e?.y) / 1000;
    const x = Number(pt ? pt[1] : e?.x) / 1000;
    const z = Number(e?.ziel);
    if (!imBild(x) || !imBild(y)) continue;
    punkte.push({ x, y, ziel: Number.isInteger(z) && z >= 0 && z < anzahlZiele ? z : null });
  }
  return punkte;
}

/**
 * Doppelte zusammenführen: Liegen zwei Punkte näher als `abstand` (Anteil der Bilddiagonale),
 * ist es dasselbe Teil – etwa weil es unter zwei Arten gefunden wurde. Der erste gewinnt.
 */
export function doppeltePunkteEntfernen(punkte: ZaehlPunkt[], breite: number, hoehe: number, abstand = 0.025): ZaehlPunkt[] {
  const diag = Math.hypot(breite, hoehe);
  const grenze = abstand * diag;
  const behalten: ZaehlPunkt[] = [];
  for (const p of punkte) {
    if (!behalten.some((b) => Math.hypot((b.x - p.x) * breite, (b.y - p.y) * hoehe) < grenze)) behalten.push(p);
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

/** Anweisung für Gemini. Die Ziele sind nummeriert, damit jeder Punkt einer Art zugeordnet werden kann. */
export function geminiAnweisung(ziele: string[]): string {
  return [
    "Du hilfst bei der Inventur in einem Lager. Auf dem Foto ist ein Regal oder Fach.",
    "Setze für JEDES einzelne sichtbare Exemplar der folgenden Arten genau EINEN Punkt auf die Mitte des Teils:",
    ...ziele.map((t, i) => `${i}: ${t}`),
    "",
    "Regeln:",
    "- Jedes physische Teil genau einmal, auch wenn es teilweise verdeckt ist. Nichts doppelt.",
    "- Gleiche Teile nebeneinander oder gestapelt einzeln zählen.",
    "- Teile, die zu keiner Art passen, Regalböden, Etiketten und Hintergrund nicht markieren.",
    "- Bei Zweifel, welcher Art ein Teil angehört: die passendste wählen.",
    'Antworte NUR mit JSON: {"punkte":[{"ziel":0,"y":500,"x":500}]}',
    "y und x sind auf 0–1000 normiert (0,0 = oben links). ziel ist die Nummer der Art.",
  ].join("\n");
}

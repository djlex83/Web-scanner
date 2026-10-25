// Zählhilfe: Ausgabe des Objekterkenners lesen und mit den Strichcodes desselben Fotos abgleichen.
// Reine Funktionen ohne Browser-APIs – damit testbar und unabhängig vom Modell.

export interface Kasten {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Sicherheit 0–1 */
  wert: number;
}

export interface Punkt {
  x: number;
  y: number;
}

/** Ein gelesener Strichcode mit seinen Eckpunkten im Foto. */
export interface CodeFund {
  code: string;
  ecken: Punkt[];
}

export interface Gegenstand extends Kasten {
  /** Code, der in diesem Gegenstand liegt; null = kein Etikett gelesen */
  code: string | null;
}

/** Letterbox-Abbildung vom Modell-Eingang (z. B. 640×640) zurück aufs Foto. */
export interface Rahmen {
  faktor: number;
  versatzX: number;
  versatzY: number;
  breite: number;
  hoehe: number;
}

export function rahmenBerechnen(breite: number, hoehe: number, eingang: number): Rahmen {
  const faktor = Math.min(eingang / breite, eingang / hoehe);
  return {
    faktor,
    versatzX: (eingang - breite * faktor) / 2,
    versatzY: (eingang - hoehe * faktor) / 2,
    breite,
    hoehe,
  };
}

const flaeche = (k: Kasten) => Math.max(0, k.x2 - k.x1) * Math.max(0, k.y2 - k.y1);

function schnitt(a: Kasten, b: Kasten): number {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? w * h : 0;
}

export function iou(a: Kasten, b: Kasten): number {
  const s = schnitt(a, b);
  return s ? s / (flaeche(a) + flaeche(b) - s) : 0;
}

/**
 * Ausgabe eines End-to-End-Modells (YOLO26/YOLOE-26): `anzahl` Zeilen à `spalten` Werte,
 * die ersten sechs sind x1, y1, x2, y2, Sicherheit, Klasse – in Koordinaten des Modell-Eingangs.
 * Weitere Spalten (Masken-Koeffizienten) werden ignoriert.
 */
export function ausgabeLesen(daten: ArrayLike<number>, spalten: number, rahmen: Rahmen, schwelle: number): Kasten[] {
  if (spalten < 6) throw new Error(`Unerwartete Modellausgabe (${spalten} Spalten)`);
  const kaesten: Kasten[] = [];
  const zeilen = Math.floor(daten.length / spalten);
  const zurueck = (v: number, versatz: number, max: number) => Math.min(max, Math.max(0, (v - versatz) / rahmen.faktor));
  for (let i = 0; i < zeilen; i++) {
    const o = i * spalten;
    const wert = daten[o + 4]!;
    if (!(wert >= schwelle)) continue;
    const k = {
      x1: zurueck(daten[o]!, rahmen.versatzX, rahmen.breite),
      y1: zurueck(daten[o + 1]!, rahmen.versatzY, rahmen.hoehe),
      x2: zurueck(daten[o + 2]!, rahmen.versatzX, rahmen.breite),
      y2: zurueck(daten[o + 3]!, rahmen.versatzY, rahmen.hoehe),
      wert,
    };
    if (k.x2 - k.x1 >= 2 && k.y2 - k.y1 >= 2) kaesten.push(k);
  }
  return kaesten;
}

/**
 * Doppelte entfernen, unabhängig von der Klasse: Das prompt-freie Modell meldet denselben
 * Gegenstand oft unter zwei Namen („Werkzeug“, „Bohrmaschine“) – gezählt wird er einmal.
 * Ebenso fliegt ein Kasten raus, der fast ganz in einem sichereren liegt (Teil eines Gegenstands).
 */
export function doppelteEntfernen(kaesten: Kasten[], maxIou = 0.5, maxInnen = 0.85): Kasten[] {
  const sortiert = [...kaesten].sort((a, b) => b.wert - a.wert);
  const behalten: Kasten[] = [];
  for (const k of sortiert) {
    const doppelt = behalten.some((b) => {
      if (iou(k, b) > maxIou) return true;
      const f = flaeche(k);
      return f > 0 && schnitt(k, b) / f > maxInnen && flaeche(b) < f * 4;
    });
    if (!doppelt) behalten.push(k);
  }
  return behalten;
}

/** Kästen, die keine einzelnen Gegenstände sind: das ganze Regal, ein ganzes Fach. */
export function zuGrossEntfernen(kaesten: Kasten[], breite: number, hoehe: number, maxAnteil = 0.45): Kasten[] {
  const bild = breite * hoehe;
  return kaesten.filter((k) => flaeche(k) / bild <= maxAnteil);
}

function codeKasten(f: CodeFund): Kasten {
  const xs = f.ecken.map((p) => p.x);
  const ys = f.ecken.map((p) => p.y);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys), wert: 1 };
}

/**
 * Jeden gelesenen Code dem kleinsten Gegenstand zuordnen, in dem seine Mitte liegt.
 * Ein Kasten, der im Wesentlichen nur das Etikett selbst ist, zählt nicht als Gegenstand.
 */
export function codesZuordnen(kaesten: Kasten[], funde: CodeFund[]): { gegenstaende: Gegenstand[]; ohneGegenstand: string[] } {
  const etiketten = funde.filter((f) => f.ecken.length > 0).map((f) => ({ code: f.code, k: codeKasten(f) }));
  const gegenstaende: Gegenstand[] = kaesten
    .filter((k) => !etiketten.some((e) => iou(k, e.k) > 0.5))
    .map((k) => ({ ...k, code: null }));
  const ohneGegenstand: string[] = [];
  for (const e of etiketten) {
    const mx = (e.k.x1 + e.k.x2) / 2;
    const my = (e.k.y1 + e.k.y2) / 2;
    let bester: Gegenstand | null = null;
    for (const g of gegenstaende) {
      if (g.code || mx < g.x1 || mx > g.x2 || my < g.y1 || my > g.y2) continue;
      if (!bester || flaeche(g) < flaeche(bester)) bester = g;
    }
    if (bester) bester.code = e.code;
    else ohneGegenstand.push(e.code);
  }
  return { gegenstaende, ohneGegenstand };
}

export interface ZaehlErgebnis {
  gegenstaende: Gegenstand[];
  /** alle gelesenen Codes auf dem Foto */
  codes: string[];
  mitCode: number;
  ohneCode: number;
  /** Gegenstände im Bild + Codes, die keinem erkannten Gegenstand zugeordnet werden konnten */
  geschaetzt: number;
}

export function auswerten(kaesten: Kasten[], funde: CodeFund[], breite: number, hoehe: number): ZaehlErgebnis {
  const bereinigt = doppelteEntfernen(zuGrossEntfernen(kaesten, breite, hoehe));
  const { gegenstaende, ohneGegenstand } = codesZuordnen(bereinigt, funde);
  const mitCode = gegenstaende.filter((g) => g.code).length;
  return {
    gegenstaende,
    codes: [...new Set(funde.map((f) => f.code))],
    mitCode,
    ohneCode: gegenstaende.length - mitCode,
    geschaetzt: gegenstaende.length + new Set(ohneGegenstand).size,
  };
}
